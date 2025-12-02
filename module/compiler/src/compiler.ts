import fs from 'node:fs/promises';
import { setMaxListeners } from 'node:events';

import { ManifestIndex, ManifestModuleUtil } from '@travetto/manifest';

import { CompilerUtil } from './util.ts';
import { CompilerState } from './state.ts';
import { CompilerWatcher } from './watch.ts';
import { CompileEmitEvent, CompileEmitter, CompilerReset } from './types.ts';
import { EventUtil } from './event.ts';

import { IpcLogger } from '../support/log.ts';
import { CommonUtil } from '../support/util.ts';

const log = new IpcLogger({ level: 'debug' });

/**
 * Compilation support
 */
export class Compiler {

  /**
   * Run compiler as a main entry point
   */
  static async main(): Promise<void> {
    const [dirty, watch] = process.argv.slice(2);
    const state = await CompilerState.get(new ManifestIndex());
    log.debug('Running compiler with dirty file', dirty);
    const dirtyFiles = ManifestModuleUtil.getFileType(dirty) === 'ts' ? [dirty] : (await fs.readFile(dirty, 'utf8')).split(/\n/).filter(x => !!x);
    log.debug('Running compiler with dirty file', dirtyFiles);
    await new Compiler(state, dirtyFiles, watch === 'true').run();
  }

  #state: CompilerState;
  #dirtyFiles: string[];
  #watch?: boolean;
  #ctrl: AbortController;
  #signal: AbortSignal;
  #shuttingDown = false;

  constructor(state: CompilerState, dirtyFiles: string[], watch?: boolean) {
    this.#state = state;
    this.#dirtyFiles = dirtyFiles[0] === '*' ?
      this.#state.getAllFiles() :
      dirtyFiles.map(f => this.#state.getBySource(f)!.sourceFile);
    this.#watch = watch;

    this.#ctrl = new AbortController();
    this.#signal = this.#ctrl.signal;
    setMaxListeners(1000, this.#signal);
    process
      .once('disconnect', () => this.#shutdown('manual'))
      .on('message', event => (event === 'shutdown') && this.#shutdown('manual'));
  }

  #shutdown(mode: 'error' | 'manual' | 'complete' | 'reset', err?: Error): void {
    if (this.#shuttingDown) {
      return;
    }

    this.#shuttingDown = true;
    switch (mode) {
      case 'manual': {
        log.error('Shutting down manually');
        process.exitCode = 2;
        break;
      }
      case 'error': {
        process.exitCode = 1;
        if (err) {
          EventUtil.sendEvent('log', { level: 'error', message: err.toString(), time: Date.now() });
          log.error('Shutting down due to failure', err.stack);
        }
        break;
      }
      case 'reset': {
        log.info('Reset due to', err?.message);
        EventUtil.sendEvent('state', { state: 'reset' });
        process.exitCode = 0;
        break;
      }
    }
    // No longer listen to disconnect
    process.removeAllListeners('disconnect');
    process.removeAllListeners('message');
    this.#ctrl.abort();
    CommonUtil.nonBlockingTimeout(1000).then(() => process.exit()); // Allow upto 1s to shutdown gracefully
  }

  /**
   * Log compilation statistics
   */
  logStatistics(metrics: CompileEmitEvent[]): void {
    // Simple metrics
    const durations = metrics.map(x => x.duration);
    const total = durations.reduce((a, b) => a + b, 0);
    const avg = total / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.trunc(sorted.length / 2)];

    // Find the 5 slowest files
    const slowest = [...metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .map(x => ({ file: x.file, duration: x.duration }));

    log.debug('Compilation Statistics', {
      files: metrics.length,
      totalTime: total,
      averageTime: Math.round(avg),
      medianTime: median,
      slowest
    });
  }

  /**
   * Compile in a single pass, only emitting dirty files
   */
  getCompiler(): CompileEmitter {
    return (sourceFile: string, needsNewProgram?: boolean) => this.#state.compileSourceFile(sourceFile, needsNewProgram);
  }

  /**
   * Emit all files as a stream
   */
  async * emit(files: string[], emitter: CompileEmitter): AsyncIterable<CompileEmitEvent> {
    let i = 0;
    let lastSent = Date.now();

    await emitter(files[0]); // Prime

    for (const file of files) {
      const start = Date.now();
      const err = await emitter(file);
      const duration = Date.now() - start;
      const nodeModSep = 'node_modules/';
      const nodeModIdx = file.lastIndexOf(nodeModSep);
      const imp = nodeModIdx >= 0 ? file.substring(nodeModIdx + nodeModSep.length) : file;
      yield { file: imp, i: i += 1, err, total: files.length, duration };
      if ((Date.now() - lastSent) > 50) { // Limit to 1 every 50ms
        lastSent = Date.now();
        EventUtil.sendEvent('progress', { total: files.length, idx: i, message: imp, operation: 'compile' });
      }
      if (this.#signal.aborted) {
        break;
      }
    }
    EventUtil.sendEvent('progress', { total: files.length, idx: files.length, message: 'Complete', operation: 'compile', complete: true });

    await CommonUtil.queueMacroTask();

    log.debug(`Compiled ${i} files`);
  }

  /**
   * Run the compiler
   */
  async run(): Promise<void> {
    log.debug('Compilation started');

    EventUtil.sendEvent('state', { state: 'init', extra: { pid: process.pid } });

    const emitter = await this.getCompiler();
    let failure: Error | undefined;

    log.debug('Compiler loaded');

    EventUtil.sendEvent('state', { state: 'compile-start' });

    const metrics: CompileEmitEvent[] = [];

    if (this.#dirtyFiles.length) {
      for await (const event of this.emit(this.#dirtyFiles, emitter)) {
        if (event.err) {
          const compileError = CompilerUtil.buildTranspileError(event.file, event.err);
          failure ??= compileError;
          EventUtil.sendEvent('log', { level: 'error', message: compileError.toString(), time: Date.now() });
        }
        metrics.push(event);
      }
      if (this.#signal.aborted) {
        log.debug('Compilation aborted');
      } else if (failure) {
        log.debug('Compilation failed');
        return this.#shutdown('error', failure);
      } else {
        log.debug('Compilation succeeded');
      }
    } else if (this.#watch) {
      // Prime compiler before complete
      const resolved = this.#state.getArbitraryInputFile();
      await emitter(resolved, true);
    }

    EventUtil.sendEvent('state', { state: 'compile-end' });

    if (process.env.TRV_BUILD === 'debug' && metrics.length) {
      this.logStatistics(metrics);
    }

    if (this.#watch && !this.#signal.aborted) {
      log.info('Watch is ready');

      EventUtil.sendEvent('state', { state: 'watch-start' });
      try {
        for await (const event of new CompilerWatcher(this.#state, this.#signal)) {
          if (event.action !== 'delete') {
            const err = await emitter(event.entry.sourceFile, true);
            if (err) {
              log.info('Compilation Error', CompilerUtil.buildTranspileError(event.entry.sourceFile, err));
            } else {
              log.info(`Compiled ${event.entry.sourceFile} on ${event.action}`);
            }
          } else {
            if (event.entry.outputFile) {
              // Remove output
              log.info(`Removed ${event.entry.sourceFile}, ${event.entry.outputFile}`);
              await fs.rm(event.entry.outputFile, { force: true }); // Ensure output is deleted
            }
          }

          // Send change events
          EventUtil.sendEvent('change', {
            action: event.action,
            time: Date.now(),
            file: event.file,
            output: event.entry.outputFile!,
            module: event.entry.module.name
          });
        }
        EventUtil.sendEvent('state', { state: 'watch-end' });
      } catch (err) {
        if (err instanceof Error) {
          this.#shutdown(err instanceof CompilerReset ? 'reset' : 'error', err);
        }
      }
    }

    log.debug('Compiler process shutdown');

    this.#shutdown('complete');
  }
}
