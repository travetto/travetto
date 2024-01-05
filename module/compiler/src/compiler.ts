import ts from 'typescript';
import timers from 'node:timers/promises';
import fs from 'node:fs/promises';
import { setMaxListeners } from 'node:events';

import { ManifestModuleUtil, RuntimeIndex } from '@travetto/manifest';

import { CompilerUtil } from './util';
import { CompilerState } from './state';
import { CompilerWatcher } from './watch';
import { Log } from './log';
import { CompileEmitError, CompileEmitEvent, CompileEmitter } from './types';
import { EventUtil } from './event';

/**
 * Compilation support
 */
export class Compiler {

  /**
   * Run compiler as a main entry point
   */
  static async main(): Promise<void> {
    const [dirty, watch] = process.argv.slice(2);
    const state = await CompilerState.get(RuntimeIndex);
    Log.debug('Running compiler with dirty file', dirty);
    const dirtyFiles = ManifestModuleUtil.getFileType(dirty) === 'ts' ? [dirty] : (await fs.readFile(dirty, 'utf8')).split(/\n/).filter(x => !!x);
    await new Compiler(state, dirtyFiles, watch === 'true').run();
  }

  #state: CompilerState;
  #dirtyFiles: string[];
  #watch?: boolean;
  #ctrl: AbortController;
  #signal: AbortSignal;

  constructor(state: CompilerState, dirtyFiles: string[], watch?: boolean) {
    this.#state = state;
    this.#dirtyFiles = dirtyFiles[0] === '*' ?
      this.#state.getAllFiles() :
      dirtyFiles.map(f => this.#state.getBySource(f)!.input);
    this.#watch = watch;

    this.#ctrl = new AbortController();
    this.#signal = this.#ctrl.signal;
    setMaxListeners(1000, this.#signal);
    process
      .once('disconnect', () => this.#ctrl.abort())
      .on('message', ev => (ev === 'shutdown') && this.#ctrl.abort());
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
        await timers.setImmediate();
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
    let lastSent = Date.now();

    for (const file of files) {
      const err = await emitter(file);
      const imp = file.replace(/.*node_modules\//, '');
      yield { file: imp, i: i += 1, err, total: files.length };
      if ((Date.now() - lastSent) > 50) { // Limit to 1 every 50ms
        lastSent = Date.now();
        EventUtil.sendEvent('progress', { total: files.length, idx: i, message: imp, operation: 'compile' });
      }
      if (this.#signal.aborted) {
        break;
      }
    }
    EventUtil.sendEvent('progress', { total: files.length, idx: files.length, message: 'Complete', operation: 'compile', complete: true });

    await timers.setTimeout(1);

    Log.debug(`Compiled ${i} files`);
  }

  /**
   * Run the compiler
   */
  async run(): Promise<void> {
    Log.debug('Compilation started');

    EventUtil.sendEvent('state', { state: 'init', extra: { pid: process.pid } });

    const emitter = await this.getCompiler();
    let failed = false;

    Log.debug('Compiler loaded');

    EventUtil.sendEvent('state', { state: 'compile-start' });

    if (this.#dirtyFiles.length) {
      for await (const ev of this.emit(this.#dirtyFiles, emitter)) {
        if (ev.err) {
          failed = true;
          const compileError = CompilerUtil.buildTranspileError(ev.file, ev.err);
          EventUtil.sendEvent('log', { level: 'error', message: compileError.toString(), time: Date.now() });
        }
      }
      if (this.#signal.aborted) {
        Log.debug('Compilation aborted');
      } else if (failed) {
        Log.debug('Compilation failed');
        process.exitCode = 1;
        return;
      } else {
        Log.debug('Compilation succeeded');
      }
    } else if (this.#watch) {
      // Prime compiler before complete
      const resolved = this.#state.getArbitraryInputFile();
      await emitter(resolved, true);
    }

    EventUtil.sendEvent('state', { state: 'compile-end' });

    if (this.#watch && !this.#signal.aborted) {
      Log.info('Watch is ready');

      EventUtil.sendEvent('state', { state: 'watch-start' });

      for await (const ev of new CompilerWatcher(this.#state, this.#signal).watchChanges()) {
        if (ev.action === 'reset') {
          Log.info(`Triggering reset due to change in ${ev.file}`);
          EventUtil.sendEvent('state', { state: 'reset' });
          this.#ctrl.abort();
          return;
        }
        const { action, entry } = ev;
        if (action !== 'delete') {
          const err = await emitter(entry.input, true);
          if (err) {
            Log.info('Compilation Error', CompilerUtil.buildTranspileError(entry.input, err));
          } else {
            Log.info(`Compiled ${entry.source}`);
          }
        } else {
          // Remove output
          Log.info(`Removed ${entry.source}, ${entry.output}`);
          await fs.rm(entry.output!, { force: true }); // Ensure output is deleted
        }

        // Send change events
        EventUtil.sendEvent('change', {
          action: ev.action,
          time: Date.now(),
          file: ev.file,
          folder: ev.folder,
          output: ev.entry.output!,
          module: ev.entry.module.name
        });
      }

      EventUtil.sendEvent('state', { state: 'watch-end' });
    }

    // No longer listen to disconnect
    process.removeAllListeners('disconnect');

    if (this.#ctrl.signal.aborted) {
      process.exitCode = 2;
      Log.error('Shutting down manually');
    }
  }
}
