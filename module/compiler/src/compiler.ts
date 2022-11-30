import ts from 'typescript';
import fs from 'fs/promises';
import path from 'path';

import { ManifestState } from '@travetto/manifest';

import { CompilerUtil } from './util';
import { CompilerState } from './state';

export type TransformerProvider = {
  init(checker: ts.TypeChecker): void;
  get(): ts.CustomTransformers | undefined;
};

type EmitErrorHandler = (file: string, errors: Error | readonly ts.Diagnostic[]) => void;
type Emitter = (file: string, newProgram?: boolean, onError?: EmitErrorHandler) => void;

/**
 * Compilation support
 */
export class Compiler {

  #bootTsconfig: string;
  #state: CompilerState;
  #transformers: string[];

  init(manifestState: ManifestState): this {
    this.#state = new CompilerState(manifestState);
    this.#bootTsconfig = this.#state.resolveModuleFile('@travetto/compiler', 'tsconfig.trv.json');

    this.#transformers = this.state.modules.flatMap(
      x => (x.files.support ?? [])
        .filter(([f, type]) => type === 'ts' && f.startsWith('support/transformer.'))
        .map(([f]) =>
          path.resolve(
            this.#state.manifest.workspacePath,
            this.#state.manifest.compilerFolder,
            x.output,
            f.replace(/[.][tj]s$/, '.js')
          )
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
    return TransformerManager.create(this.#transformers, this.state.manifest);
  }

  async writeRawFile(file: string, contents: string, mode?: string): Promise<void> {
    const outFile = path.resolve(
      this.#state.manifest.workspacePath,
      this.#state.manifest.outputFolder,
      file
    );
    console.debug('Writing', outFile);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, contents, { encoding: 'utf8', mode });
  }

  async outputInit(): Promise<void> {
    // Write manifest
    await this.writeRawFile(this.#state.manifest.manifestFile, JSON.stringify(this.state.manifest));
    await this.writeRawFile('trv', '#!/bin/sh\nnode node_modules/@travetto/cli/support/main.cli.js $@\n', '755');
    await this.writeRawFile('trv.cmd', 'node node_modules/@travetto/cli/support/main.cli.js %*\n', '755');
  }

  /**
   * Compile in a single pass, only emitting dirty files
   */
  async getCompiler(): Promise<Emitter> {
    let program: ts.Program;

    const transformers = await this.createTransformerProvider();
    const options = await CompilerUtil.getCompilerOptions(
      path.resolve(
        this.#state.manifest.workspacePath,
        this.#state.manifest.outputFolder,
      ),
      this.#bootTsconfig,
      this.#state.manifest.workspacePath
    );
    const host = this.state.getCompilerHost(options);

    const emit = (file: string, needsNewProgram = program === undefined, onError?: EmitErrorHandler): void => {
      console.log('Emitting file',
        file
          .replace(/[.]ts$/, '.js')
          .replace(
            this.#state.manifest.compilerFolder,
            this.#state.manifest.outputFolder
          )
      );
      if (needsNewProgram) {
        program = ts.createProgram({ rootNames: this.#state.getAllFiles(), host, options, oldProgram: program });
        transformers.init(program.getTypeChecker());
      }
      try {
        const result = program.emit(
          program.getSourceFile(file)!, host.writeFile, undefined, false, transformers.get()
        );

        if (result.diagnostics && result.diagnostics.length) {
          if (onError) {
            onError(file, result.diagnostics);
          } else {
            throw CompilerUtil.buildTranspileError(file, result.diagnostics);
          }
        }
      } catch (err) {
        if (onError && (err instanceof Error)) {
          onError(file, err);
        } else {
          throw err;
        }
      }
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
    const errs: Parameters<EmitErrorHandler>[] = [];
    for (const file of this.state.getDirtyFiles()) {
      emit(file, undefined, (f, val) => errs.push([f, val]));
    }

    if (errs.length) {
      for (const [file, diags] of errs) {
        const err = diags instanceof Error ? diags : CompilerUtil.buildTranspileError(file, diags);
        console.error(err);
      }
      process.exit(-1);
    }

    if (this.isWatching()) {
      await this.#watchLocalModules(emit);
      await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24));
    }
  }
}