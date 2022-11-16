import * as ts from 'typescript';
import * as sourceMapSupport from 'source-map-support';
import * as fs from 'fs/promises';

import type { ManifestState } from '@travetto/manifest';

import { CompilerUtil } from './util';
import { CompilerState } from './state';

export type TransformerProvider = {
  init(checker: ts.TypeChecker): void;
  get(): ts.CustomTransformers | undefined;
};

type Emitter = (file: string, newProgram?: boolean) => void;

/**
 * Base compilation support
 */
export class Compiler {

  static async main(
    stateFile: string = process.argv.at(-2)!,
    outDir: string = process.argv.at(-1)!
  ): Promise<void> {
    // Register source maps
    sourceMapSupport.install();

    const state: ManifestState = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    return new this().init(state, outDir).run();
  }

  #bootTsconfig: string;
  #state: CompilerState;

  init(
    manifestState: ManifestState,
    outputFolder: string
  ): typeof this {
    this.#state = new CompilerState(manifestState, outputFolder);
    this.#bootTsconfig = this.#state.resolveModuleFile('@travetto/manifest', 'tsconfig.trv.json');
    return this;
  }

  get state(): CompilerState {
    return this.#state;
  }

  createTransformerProvider?(): Promise<TransformerProvider>;

  outputInit?(): Promise<void>;

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

  /**
   * Compile in a single pass, only emitting dirty files
   */
  async getCompiler(): Promise<Emitter> {
    let program: ts.Program;

    const transformers = await this.createTransformerProvider?.();
    const options = await CompilerUtil.getCompilerOptions(this.#state.outputFolder, this.#bootTsconfig);
    const host = this.state.getCompilerHost(options);

    const emit = (file: string, needsNewProgram = program === undefined): void => {
      console.error('Emitting file', file);
      if (needsNewProgram) {
        program = ts.createProgram({ rootNames: this.#state.getAllFiles(), host, options, oldProgram: program });
        transformers?.init(program.getTypeChecker());
      }
      const result = program.emit(
        program.getSourceFile(file)!, host.writeFile, undefined, false, transformers?.get()
      );
      CompilerUtil.checkTranspileErrors(file, result.diagnostics);
    };

    return emit;
  }

  isWatching(): boolean {
    return false;
  }

  /**
   * Run the compiler
   */
  async run(): Promise<void> {
    await this.outputInit?.();
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