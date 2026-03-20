import fs from 'node:fs/promises';
import { setMaxListeners } from 'node:events';

import { getManifestContext, ManifestDeltaUtil, ManifestIndex, ManifestUtil, type DeltaEvent } from '@travetto/manifest';

import { CompilerState } from './state.ts';
import { CompilerWatcher } from './watch.ts';
import { type CompileEmitEvent, CompilerReset } from './types.ts';
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
  #shutdownController: AbortController;
  #shutdownSignal: AbortSignal;
  #shuttingDown = false;
  #deltaEvents: DeltaEvent[];

  constructor(state: CompilerState, deltaEvents: DeltaEvent[], watch?: boolean) {
    this.#state = state;
    this.#watch = watch;
    this.#deltaEvents = deltaEvents;

    this.#shutdownController = new AbortController();
    this.#shutdownSignal = this.#shutdownController.signal;
    setMaxListeners(1000, this.#shutdownSignal);
    process
      .once('disconnect', () => this.#shutdown('manual'))
      .on('message', event => (event === 'shutdown') && this.#shutdown('manual'));
  }

  #shutdown(mode: 'error' | 'manual' | 'complete' | 'reset', errorMessage?: string): void {
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
        if (errorMessage) {
          log.error('Shutting down due to failure', errorMessage);
        }
        break;
      }
      case 'reset': {
        log.info('Reset due to', errorMessage);
        EventUtil.sendEvent('state', { state: 'reset' });
        process.exitCode = 0;
        break;
      }
    }
    // No longer listen to disconnect
    process.removeAllListeners('disconnect');
    process.removeAllListeners('message');
    this.#shutdownController.abort();
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
   * Emit all files as a stream
   */
  async * emit(files: string[]): AsyncIterable<CompileEmitEvent> {
    let i = 0;
    let lastSent = Date.now();

    for (const file of files) {
      const start = Date.now();
      const errors = await this.#state.compileSourceFile(file);
      const duration = Date.now() - start;
      const nodeModSeparator = 'node_modules/';
      const nodeModIdx = file.lastIndexOf(nodeModSeparator);
      const imp = nodeModIdx >= 0 ? file.substring(nodeModIdx + nodeModSeparator.length) : file;
      yield { file: imp, i: i += 1, errors, total: files.length, duration };
      if ((Date.now() - lastSent) > 50) { // Limit to 1 every 50ms
        lastSent = Date.now();
        EventUtil.sendEvent('progress', { total: files.length, idx: i, message: imp, operation: 'compile' });
      }
      if (this.#shutdownSignal.aborted) {
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

    const failures = new Map<string, number>();

    log.debug(`Compiler loaded: ${this.#deltaEvents.length} files changed`);

    EventUtil.sendEvent('state', { state: 'compile-start' });

    const metrics: CompileEmitEvent[] = [];
    const isCompilerChanged = this.#deltaEvents.some(event => this.#state.isCompilerFile(event.sourceFile));
    const changedFiles = (isCompilerChanged ? this.#state.getAllFiles() : this.#deltaEvents.map(event => event.sourceFile));

    if (changedFiles.length) {
      for await (const event of this.emit(changedFiles)) {
        if (event.errors?.length) {
          failures.set(event.file, event.errors.length);
          for (const error of event.errors) {
            log.error(`ERROR ${event.file}:${error}`);
          }
          // Touch file to ensure recompilation later
          if (await fs.stat(event.file, { throwIfNoEntry: false })) {
            await fs.utimes(event.file, new Date(), new Date());
          }
        }
        metrics.push(event);
      }
      if (this.#shutdownSignal.aborted) {
        log.debug('Compilation aborted');
      } else if (failures.size) {
        const sortedFailures = [...failures.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        log.error('Compilation failed',
          ['', sortedFailures.flatMap(([file, count]) => `- ${file}: ${count} errors found`)]
            .flat(3).join('\n')
        );
      } else {
        log.debug('Compilation succeeded');
      }

      // Rebuild manifests
      const manifest = await ManifestUtil.buildManifest(this.#state.manifestIndex.manifest);
      await ManifestUtil.writeManifest(manifest);
      await ManifestUtil.writeDependentManifests(manifest);

      if (!this.#watch && failures.size) {
        return this.#shutdown('error');
      }

      this.#state.manifestIndex.reinitForModule(this.#state.manifest.main.name); // Reload
    }

    EventUtil.sendEvent('state', { state: 'compile-end' });

    if (process.env.TRV_BUILD === 'debug' && metrics.length) {
      this.logStatistics(metrics);
    }

    if (this.#watch && !this.#shutdownSignal.aborted) {
      const resolved = this.#state.getArbitraryInputFile();
      await this.#state.compileSourceFile(resolved);

      log.info('Watch is ready');

      EventUtil.sendEvent('state', { state: 'watch-start' });
      try {
        for await (const event of new CompilerWatcher(this.#state, this.#shutdownSignal)) {
          if (event.action !== 'delete') {
            const errors = await this.#state.compileSourceFile(event.entry.sourceFile, true);
            if (errors?.length) {
              log.error('Compilation failed', `${event.entry.sourceFile}: ${errors.length} errors found`);
              for (const error of errors) {
                log.error(`ERROR ${event.file}:${error}`);
              }
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
          this.#shutdown(error instanceof CompilerReset ? 'reset' : 'error', error.message);
        }
      }
    }

    log.debug('Compiler process shutdown');

    this.#shutdown('complete');
  }
}