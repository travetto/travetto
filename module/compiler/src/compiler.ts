import * as ts from 'typescript';
import * as fs from 'fs/promises';

import { ManifestState, path } from '@travetto/manifest';

import { CompilerUtil } from './util';
import { CompilerState } from './state';

export type TransformerProvider = {
  init(checker: ts.TypeChecker): void;
  get(): ts.CustomTransformers | undefined;
};

type Emitter = (file: string, newProgram?: boolean) => void;

/**
 * Compilation support
 */
export class Compiler {

  #bootTsconfig: string;
  #state: CompilerState;
  #transformers: string[];

  init(
    manifestState: ManifestState,
    outputFolder: string
  ): this {
    this.#state = new CompilerState(manifestState, outputFolder);
    this.#bootTsconfig = this.#state.resolveModuleFile('@travetto/compiler', 'tsconfig.trv.json');

    this.#transformers = this.state.modules.flatMap(
      x => (x.files.support ?? [])
        .filter(([f, type]) => type === 'ts' && f.startsWith('support/transformer.'))
        .map(([f]) =>
          (`${manifestState.manifest.buildLocation}/${x.output}/${f}`.replace(/[.][tj]s$/, ''))
        )
    );

    return this;
  }

  get state(): CompilerState {
    return this.#state;
  }

  /**
   * Watches local modules
   */
  async #watchLocalModules(emit: Emitter): Promise<() => Promise<void>> {
    const folders = this.state.modules.filter(x => x.local).map(x => x.source);
    const watcher = this.state.getWatcher({
      create: (inputFile) => emit(inputFile, true),
      update: (inputFile) => emit(inputFile, true),
      delete: (outputFile) => fs.unlink(outputFile)
    });
    return CompilerUtil.fileWatcher(folders, watcher);
  }

  async createTransformerProvider(): Promise<TransformerProvider> {
    const { TransformerManager } = await import('@travetto/transformer');
    return TransformerManager.create(this.#transformers, this.state.modules);
  }

  async writeRawFile(file: string, contents: string): Promise<void> {
    const outFile = path.resolve(this.state.outputFolder, file);
    console.debug('Writing', outFile);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, contents, 'utf8');
  }

  async outputInit(): Promise<void> {
    // Write manifest
    await this.writeRawFile('manifest.json', JSON.stringify(this.state.manifest));
    await this.writeRawFile('.env.js', `
process.env.TRV_OUTPUT=process.cwd();
process.env.TRV_COMPILED=1;
`);
  }

  /**
   * Compile in a single pass, only emitting dirty files
   */
  async getCompiler(): Promise<Emitter> {
    let program: ts.Program;

    const transformers = await this.createTransformerProvider();
    const options = await CompilerUtil.getCompilerOptions(this.#state.outputFolder, this.#bootTsconfig);
    const host = this.state.getCompilerHost(options);

    const emit = (file: string, needsNewProgram = program === undefined): void => {
      console.error('Emitting file', file);
      if (needsNewProgram) {
        program = ts.createProgram({ rootNames: this.#state.getAllFiles(), host, options, oldProgram: program });
        transformers.init(program.getTypeChecker());
      }
      const result = program.emit(
        program.getSourceFile(file)!, host.writeFile, undefined, false, transformers.get()
      );
      CompilerUtil.checkTranspileErrors(file, result.diagnostics);
    };

    return emit;
  }

  isWatching(): boolean {
    return process.env.TRV_WATCH === 'true';
  }

  /**
   * Run the compiler
   */
  async run(): Promise<void> {
    await this.outputInit();
    const emit = await this.getCompiler();

    // Emit dirty files
    for (const file of this.state.getDirtyFiles()) {
      emit(file);
    }

    if (this.isWatching()) {
      await this.#watchLocalModules(emit);
      await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24));
    }
  }
}