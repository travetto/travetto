import ts from 'typescript';
import fs from 'fs/promises';

import { GlobalTerminal, TerminalProgressEvent } from '@travetto/terminal';
import { RootIndex, ManifestWatcher } from '@travetto/manifest';
import { TransformerManager } from '@travetto/transformer';

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
  #dirtyFiles: string[];

  constructor(dirtyFiles: string[]) {
    this.#state = new CompilerState(RootIndex.manifest);
    this.#dirtyFiles = dirtyFiles[0] === '*' ?
      this.#state.getAllFiles() :
      dirtyFiles.map(f => this.#state.resolveInput(f));
  }

  get state(): CompilerState {
    return this.#state;
  }

  /**
   * Watches local modules
   */
  async #watchLocalModules(emit: Emitter): Promise<() => Promise<void>> {
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
    return ManifestWatcher.watchInput(watcher);
  }

  async createTransformerProvider(): Promise<TransformerProvider> {
    return TransformerManager.create(this.state.transformers);
  }

  /**
   * Compile in a single pass, only emitting dirty files
   */
  async getCompiler(): Promise<Emitter> {
    let program: ts.Program;

    const transformers = await this.createTransformerProvider();
    const options = await this.state.getCompilerOptions();
    const host = this.state.getCompilerHost(options);

    const emit = async (file: string, needsNewProgram = program === undefined): Promise<EmitError | undefined> => {
      try {
        if (needsNewProgram) {
          program = ts.createProgram({ rootNames: this.#state.getAllFiles(), host, options, oldProgram: program });
          transformers.init(program.getTypeChecker());
        }
        if (file.endsWith('.json')) {
          host.writeFile(file, host.readFile(file)!, false);
        } else if (file.endsWith('.js')) {
          host.writeFile(file, ts.transpile(host.readFile(file)!, options), false);
        } else {
          const result = program.emit(
            program.getSourceFile(file)!, host.writeFile, undefined, false, transformers.get()
          );

          if (result.diagnostics?.length) {
            return result.diagnostics;
          }
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
    for (const file of files) {
      const err = await emitter(file);
      const imp = file.replace(/.*node_modules\//, '');
      yield { file: imp, i: i += 1, err, total: files.length };
    }
  }

  /**
   * Run the compiler
   */
  async run(watch?: boolean): Promise<void> {
    const emitter = await this.getCompiler();
    let failed = false;

    const resolveEmittedFile = ({ file, total, i, err }: EmitEvent): TerminalProgressEvent => {
      if (err) {
        failed = true;
        console.error(CompilerUtil.buildTranspileError(file, err));
      }
      return { idx: i, total, text: `Compiling [%idx/%total] -- ${file}` };
    };

    if (this.#dirtyFiles.length) {
      await GlobalTerminal.trackProgress(this.emit(this.#dirtyFiles, emitter), resolveEmittedFile, { position: 'bottom' });
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