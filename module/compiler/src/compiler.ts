import fs from 'node:fs/promises';
import { setMaxListeners } from 'node:events';

import { getManifestContext, ManifestDeltaUtil, ManifestIndex, ManifestUtil, type DeltaEvent } from '@travetto/manifest';

import { CompilerUtil } from './util.ts';
import { CompilerState } from './state.ts';
import { CompilerWatcher } from './watch.ts';
import { type CompileEmitEvent, type CompileEmitter, CompilerReset } from './types.ts';
import { EventUtil } from './event.ts';

import { IpcLogger } from './log.ts';
import { CommonUtil } from './common.ts';

const log = new IpcLogger({ level: 'debug' });

/**
 * Compilation support
 */
export class Compiler {

  /**
   * Run compiler as a main entry point
   */
  static async main(): Promise<void> {
    const ctx = ManifestUtil.getWorkspaceContext(getManifestContext());
    const manifest = await ManifestUtil.buildManifest(ctx);
    const delta = await ManifestDeltaUtil.produceDelta(manifest);
    const state = await CompilerState.get(new ManifestIndex(manifest));
    await new Compiler(state, delta, process.env.TRV_COMPILER_WATCH === 'true').run();
  }

  #state: CompilerState;
  #watch?: boolean;
  #controller: AbortController;
  #signal: AbortSignal;
  #shuttingDown = false;
  #deltaEvents: DeltaEvent[];

  constructor(state: CompilerState, deltaEvents: DeltaEvent[], watch?: boolean) {
    this.#state = state;
    this.#watch = watch;
    this.#deltaEvents = deltaEvents;

    this.#controller = new AbortController();
    this.#signal = this.#controller.signal;
    setMaxListeners(1000, this.#signal);
    process
      .once('disconnect', () => this.#shutdown('manual'))
      .on('message', event => (event === 'shutdown') && this.#shutdown('manual'));
  }

  #shutdown(mode: 'error' | 'manual' | 'complete' | 'reset', error?: Error): void {
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
        if (error) {
          EventUtil.sendEvent('log', { level: 'error', message: error.toString(), time: Date.now() });
          log.error('Shutting down due to failure', error.stack);
        }
        break;
      }
      case 'reset': {
        log.info('Reset due to', error?.message);
        EventUtil.sendEvent('state', { state: 'reset' });
        process.exitCode = 0;
        break;
      }
    }
    // No longer listen to disconnect
    process.removeAllListeners('disconnect');
    process.removeAllListeners('message');
    this.#controller.abort();
    CommonUtil.nonBlockingTimeout(1000).then(() => process.exit()); // Allow upto 1s to shutdown gracefully
  }

  /**
   * Log compilation statistics
   */
  logStatistics(metrics: CompileEmitEvent[]): void {
    // Simple metrics
    const durations = metrics.map(event => event.duration);
    const total = durations.reduce((a, b) => a + b, 0);
    const avg = total / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.trunc(sorted.length / 2)];

    // Find the 5 slowest files
    const slowest = [...metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .map(event => ({ file: event.file, duration: event.duration }));

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
      const error = await emitter(file);
      const duration = Date.now() - start;
      const nodeModSeparator = 'node_modules/';
      const nodeModIdx = file.lastIndexOf(nodeModSeparator);
      const imp = nodeModIdx >= 0 ? file.substring(nodeModIdx + nodeModSeparator.length) : file;
      yield { file: imp, i: i += 1, error, total: files.length, duration };
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

    EventUtil.sendEvent('state', { state: 'init', extra: { processId: process.pid } });

    const emitter = await this.getCompiler();
    let failure: Error | undefined;

    log.debug('Compiler loaded');

    EventUtil.sendEvent('state', { state: 'compile-start' });

    const metrics: CompileEmitEvent[] = [];
    const isCompilerChanged = this.#deltaEvents.some(event => this.#state.isCompilerFile(event.sourceFile));
    const changedFiles = (isCompilerChanged ? this.#state.getAllFiles() : this.#deltaEvents.map(event => event.sourceFile));

    if (this.#watch || changedFiles.length) {
      await ManifestUtil.writeManifest(this.#state.manifestIndex.manifest);
      await this.#state.initializeTypescript();
    }

    if (changedFiles.length) {
      for await (const event of this.emit(changedFiles, emitter)) {
        if (event.error) {
          const compileError = CompilerUtil.buildTranspileError(event.file, event.error);
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

      // Rebuild manifests if dirty
      const manifest = await ManifestUtil.buildManifest(this.#state.manifestIndex.manifest);
      await ManifestUtil.writeManifest(manifest);
      await ManifestUtil.writeDependentManifests(manifest);
      this.#state.manifestIndex.reinitForModule(this.#state.manifest.main.name); // Reload
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
            const error = await emitter(event.entry.sourceFile, true);
            if (error) {
              log.info('Compilation Error', CompilerUtil.buildTranspileError(event.entry.sourceFile, error));
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
            import: event.entry.import,
            output: event.entry.outputFile!,
            module: event.entry.module.name
          });
        }
        EventUtil.sendEvent('state', { state: 'watch-end' });
      } catch (error) {
        if (error instanceof Error) {
          this.#shutdown(error instanceof CompilerReset ? 'reset' : 'error', error);
        }
      }
    }

    log.debug('Compiler process shutdown');

    this.#shutdown('complete');
  }
}
