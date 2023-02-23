import { install } from 'source-map-support';
import ts from 'typescript';
import fs from 'fs/promises';

import { GlobalTerminal, TerminalProgressEvent } from '@travetto/terminal';
import { RootIndex } from '@travetto/manifest';

import { CompilerUtil } from './util';
import { CompilerState } from './state';
import { CompilerWatcher } from './watch';
import { Log } from './log';
import { CompileEmitError, CompileEmitEvent, CompileEmitter } from './types';

/**
 * Compilation support
 */
export class Compiler {

  /**
   * Run compiler as a main entry point
   */
  static async main(): Promise<void> {
    const [dirty, watch] = process.argv.slice(2);
    install();
    const dirtyFiles = (await fs.readFile(dirty, 'utf8')).split(/\n/).filter(x => !!x);
    return new Compiler().init(dirtyFiles).then(c => c.run(watch === 'true'));
  }

  #state: CompilerState;
  #dirtyFiles: string[];

  async init(dirtyFiles: string[]): Promise<this> {
    this.#state = await CompilerState.get(RootIndex);
    this.#dirtyFiles = dirtyFiles[0] === '*' ?
      this.#state.getAllFiles() :
      dirtyFiles.map(f => this.#state.getBySource(f)!.input);

    return this;
  }

  /**
   * Watches local modules
   */
  #watchLocalModules(emit: CompileEmitter): Promise<() => Promise<void>> {
    return new CompilerWatcher(this.#state).watchFiles(async file => {
      const err = await emit(file, true);
      if (err) {
        Log.info('Compilation Error', CompilerUtil.buildTranspileError(file, err));
      } else {
        Log.info(`Compiled ${file.split('node_modules/')[1]}`);
      }
      return err;
    });
  }

  /**
   * Compile in a single pass, only emitting dirty files
   */
  async getCompiler(): Promise<CompileEmitter> {
    let program: ts.Program;

    const emit = async (inputFile: string, needsNewProgram = program === undefined): Promise<CompileEmitError | undefined> => {
      try {
        if (needsNewProgram) {
          program = this.#state.createProgram(program);
        }
        const result = this.#state.writeInputFile(program, inputFile);
        if (result?.diagnostics?.length) {
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
  async * emit(files: string[], emitter: CompileEmitter): AsyncIterable<CompileEmitEvent> {
    let i = 0;
    for (const file of files) {
      const err = await emitter(file);
      const imp = file.replace(/.*node_modules\//, '');
      yield { file: imp, i: i += 1, err, total: files.length };
    }
    Log.debug(`Compiled ${i} files`);
  }

  /**
   * Run the compiler
   */
  async run(watch?: boolean): Promise<void> {
    Log.debug('Compilation started');

    process.on('disconnect', () => process.exit(0));

    const emitter = await this.getCompiler();
    let failed = false;

    Log.debug('Compiler loaded');

    const resolveEmittedFile = ({ file, total, i, err }: CompileEmitEvent): TerminalProgressEvent => {
      if (err) {
        failed = true;
        console.error(CompilerUtil.buildTranspileError(file, err));
      }
      return { idx: i, total, text: `Compiling [%idx/%total] -- ${file}` };
    };

    if (this.#dirtyFiles.length) {
      await GlobalTerminal.trackProgress(this.emit(this.#dirtyFiles, emitter), resolveEmittedFile, { position: 'bottom' });
      if (failed) {
        Log.debug('Compilation failed');
        process.exit(1);
      } else {
        Log.debug('Compilation succeeded');
      }
    } else if (watch) {
      // Prime compiler before complete
      const resolved = this.#state.getArbitraryInputFile();
      await emitter(resolved, true);
    }

    process.send?.('build-complete');

    if (watch) {
      Log.info('Watch is ready');
      await this.#watchLocalModules(emitter);
      const output = this.#state.resolveOutputFile('.');
      for await (const _ of fs.watch(output)) {
        if (!await fs.stat(output).catch(() => false)) {
          process.send?.('restart');
        }
      }
    }
  }
}