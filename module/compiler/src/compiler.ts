import ts from 'typescript';
import fs from 'fs/promises';
import path from 'path';

import { ManifestState, ManifestUtil } from '@travetto/manifest';
import { GlobalTerminal, TerminalProgressEvent } from '@travetto/terminal';

import { CompilerUtil } from './util';
import { CompilerState } from './state';

export type TransformerProvider = {
  init(checker: ts.TypeChecker): void;
  get(): ts.CustomTransformers | undefined;
};

type EmitError = Error | readonly ts.Diagnostic[];
type Emitter = (file: string, newProgram?: boolean) => Promise<EmitError | undefined>;
type EmitEvent = { file: string, i: number, total: number, err?: EmitError };

/**
 * Compilation support
 */
export class Compiler {

  #state: CompilerState;
  #transformers: string[];

  init(manifestState: ManifestState): this {
    this.#state = new CompilerState(manifestState);

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
    const emitWithError = async (file: string): Promise<void> => {
      const err = await emit(file, true);
      if (err) {
        console.error(CompilerUtil.buildTranspileError(file, err));
      } else {
        console.error('Compiled', file.split('node_modules/')[1]);
      }
    };
    const watcher = this.state.getWatcher({
      create: emitWithError,
      update: emitWithError,
      delete: (outputFile) => fs.unlink(outputFile).catch(() => { })
    });
    return CompilerUtil.fileWatcher(folders, watcher);
  }

  async createTransformerProvider(): Promise<TransformerProvider> {
    const { TransformerManager } = await import('@travetto/transformer');
    return TransformerManager.create(this.#transformers, this.state.manifest);
  }

  /**
   * Compile in a single pass, only emitting dirty files
   */
  async getCompiler(): Promise<Emitter> {
    let program: ts.Program;

    const transformers = await this.createTransformerProvider();
    const options = await CompilerUtil.getCompilerOptions(this.#state.manifest);
    const host = this.state.getCompilerHost(options);

    const emit = async (file: string, needsNewProgram = program === undefined): Promise<EmitError | undefined> => {
      try {
        if (needsNewProgram) {
          program = ts.createProgram({ rootNames: this.#state.getAllFiles(), host, options, oldProgram: program });
          transformers.init(program.getTypeChecker());
        }

        const result = program.emit(
          program.getSourceFile(file)!, host.writeFile, undefined, false, transformers.get()
        );

        if (result.diagnostics?.length) {
          return result.diagnostics;
        }
      } catch (err) {
        if (err instanceof Error) {
          return err;
        } else {
          throw err;
        }
      }
    };

    return emit;
  }

  /**
   * Emit all files as a stream
   */
  async * emit(files: string[], emitter: Emitter): AsyncIterable<EmitEvent> {
    let i = 0;
    const manifest = this.#state.manifest;
    for (const file of files) {
      const err = await emitter(file);
      const outputFile = file
        .replace(/[.]ts$/, '.js')
        .replace(manifest.compilerFolder, manifest.outputFolder);
      yield { file: outputFile, i: i += 1, err, total: files.length };
    }
  }

  /**
   * Run the compiler
   */
  async run(watch?: boolean): Promise<void> {
    await ManifestUtil.writeManifest(this.#state.manifest, this.#state.manifest);
    const emitter = await this.getCompiler();
    let failed = false;

    const resolveEmittedFile = ({ file, total, i, err }: EmitEvent): TerminalProgressEvent => {
      if (err) {
        failed = true;
        console.error(CompilerUtil.buildTranspileError(file, err));
      }
      return { idx: i, total, text: `Compiling [%idx/%total] -- ${file.split('node_modules/')[1]}` };
    };

    let files = this.state.getDirtyFiles();
    if (!watch && !files.length) {
      files = this.state.getAllFiles();
    }

    if (files.length) {
      await GlobalTerminal.trackProgress(this.emit(files, emitter), resolveEmittedFile, { position: 'bottom' });
      if (failed) {
        process.exit(1);
      }
    }

    if (watch) {
      await this.#watchLocalModules(emitter);
      await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24));
    }
  }
}