import { install } from 'source-map-support';
import ts from 'typescript';
import fs from 'fs/promises';

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
    const dirtyFiles = ManifestModuleUtil.getFileType(dirty) === 'ts' ? [dirty] : (await fs.readFile(dirty, 'utf8')).split(/\n/).filter(x => !!x);
    await new Compiler(state, dirtyFiles, watch === 'true').run();
    process.exit();
  }

  #state: CompilerState;
  #dirtyFiles: string[];
  #watch?: boolean;

  constructor(state: CompilerState, dirtyFiles: string[], watch?: boolean) {
    this.#state = state;
    this.#dirtyFiles = dirtyFiles[0] === '*' ?
      this.#state.getAllFiles() :
      dirtyFiles.map(f => this.#state.getBySource(f)!.input);
    this.#watch = watch;
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
    let lastSent = Date.now();
    for (const file of files) {
      const err = await emitter(file);
      const imp = file.replace(/.*node_modules\//, '');
      yield { file: imp, i: i += 1, err, total: files.length };
      if ((Date.now() - lastSent) > 50) { // Limit to 1 every 50ms
        lastSent = Date.now();
        EventUtil.sendEvent('progress', { total: files.length, idx: i, message: imp, operation: 'compile' });
      }
    }
    EventUtil.sendEvent('progress', { total: files.length, idx: files.length, message: 'Complete', operation: 'compile', complete: true });
    Log.debug(`Compiled ${i} files`);
  }

  /**
   * Run the compiler
   */
  async run(): Promise<void> {
    install();

    Log.debug('Compilation started');

    EventUtil.sendEvent('state', { state: 'init', extra: { pid: process.pid } });

    if (process.send) {
      process.on('disconnect', () => process.exit(0));
    }

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
      if (failed) {
        Log.debug('Compilation failed');
        process.exit(1);
      } else {
        Log.debug('Compilation succeeded');
      }
    } else if (this.#watch) {
      // Prime compiler before complete
      const resolved = this.#state.getArbitraryInputFile();
      await emitter(resolved, true);
    }

    EventUtil.sendEvent('state', { state: 'compile-end' });

    if (this.#watch) {
      Log.info('Watch is ready');

      EventUtil.sendEvent('state', { state: 'watch-start' });

      for await (const ev of CompilerWatcher.watch(this.#state)) {
        if (ev.action === 'reset') {
          Log.info(`Triggering reset due to change in ${ev.file}`);
          EventUtil.sendEvent('state', { state: 'reset' });
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
  }
}
