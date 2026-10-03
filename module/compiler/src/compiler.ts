import { setMaxListeners } from 'node:events';
import fs from 'node:fs/promises';

import { type DeltaEvent, getManifestContext, ManifestDeltaUtil, ManifestIndex, ManifestUtil } from '@travetto/manifest';

import { CommonUtil } from './common.ts';
import { EventUtil } from './event.ts';
import { IpcLogger } from './log.ts';
import { CompilerState } from './state.ts';
import { type CompileEmitEvent, type CompilerEvent, CompilerReset, type CompilerWatchEvent } from './types.ts';
import { CompilerWatcher } from './watch.ts';

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

    try {
      const manifest = await ManifestUtil.buildManifest(ctx);
      const delta = await ManifestDeltaUtil.produceDelta(manifest);
      const state = await CompilerState.get(new ManifestIndex(manifest));
      await new Compiler(state, delta, process.env.TRV_COMPILER_WATCH === 'true').run();
    } catch (error) {
      log.error('Fatal initialization error in compiler', error, { phase: 'error' });
      EventUtil.sendEvent('state', { workspace: ctx.workspace.path, state: 'compile-failed' });
      process.exitCode = 1;
    }
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
    process.once('disconnect', () => this.#shutdown('manual')).on('message', event => event === 'shutdown' && this.#shutdown('manual'));
  }

  #sendEvent<E extends CompilerEvent>(type: E['type'], payload: E['payload']): void {
    payload.workspace = this.#state.manifest.workspace.path;
    EventUtil.sendEvent(type, payload);
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
          log.error('Shutting down due to failure', errorMessage, { phase: 'error' });
        }
        break;
      }
      case 'reset': {
        this.#sendEvent('state', { state: 'reset' });
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
  async *emit(files: string[]): AsyncIterable<CompileEmitEvent> {
    let i = 0;
    let lastSent = Date.now();

    for (const file of files) {
      const start = Date.now();
      const diagnostics = await this.#state.compileSourceFile(file);
      const duration = Date.now() - start;
      const nodeModSeparator = 'node_modules/';
      const nodeModIdx = file.lastIndexOf(nodeModSeparator);
      const imp = nodeModIdx >= 0 ? file.substring(nodeModIdx + nodeModSeparator.length) : file;
      if (diagnostics?.length) {
        for (const diagnostic of diagnostics) {
          log.error(`ERROR ${imp}:${diagnostic.line}:${diagnostic.column} -- ${diagnostic.message}`, [], { phase: 'error' });
        }
        // Touch file to ensure recompilation later
        if (await fs.stat(file, { throwIfNoEntry: false })) {
          await fs.utimes(file, new Date(), new Date());
        }
      }
      yield { file: imp, sourceFile: file, i: (i += 1), total: files.length, duration };
      if (Date.now() - lastSent > 50) {
        // Limit to 1 every 50ms
        lastSent = Date.now();
        this.#sendEvent('progress', { total: files.length, idx: i, message: imp, operation: 'compile' });
      }
      if (this.#shutdownSignal.aborted) {
        break;
      }
    }
    this.#sendEvent('progress', { total: files.length, idx: files.length, message: 'Complete', operation: 'compile', complete: true });

    await CommonUtil.queueMacroTask();

    log.debug(`Compiled ${i} files`);
  }

  async #onWatchEvent(event: CompilerWatchEvent): Promise<void> {
    const isDelete = event.action === 'delete';
    if (isDelete) {
      if (this.#state.removeSource(event.entry.sourceFile)) {
        log.info(`Removed ${event.entry.sourceFile}, ${event.entry.outputFile}`);
      }
    }

    const diagnostics = isDelete ? [] : ((await this.#state.compileSourceFile(event.entry.sourceFile, true)) ?? []);

    if (diagnostics.length) {
      log.error('Compilation failed', `${event.entry.sourceFile}: ${diagnostics.length} errors found`, { phase: 'failure' });
      for (const diagnostic of diagnostics) {
        log.error(`ERROR ${event.file}:${diagnostic.line}:${diagnostic.column} -- ${diagnostic.message}`, [], { phase: 'error' });
      }
    } else if (!isDelete) {
      log.info(`Compiled ${event.entry.sourceFile} on ${event.action}`);
    }

    this.#sendEvent('state', { state: this.#state.hasErrors() ? 'compile-failed' : 'watch-start' });

    if (!diagnostics.length) {
      this.#sendEvent('change', {
        action: event.action,
        time: Date.now(),
        file: event.file,
        import: event.entry.import,
        output: event.entry.outputFile!,
        module: event.entry.module.name
      });
    }
  }

  /**
   * Run the compiler
   */
  async run(): Promise<void> {
    log.debug('Compilation started');

    this.#sendEvent('state', { state: 'init', extra: { processId: process.pid } });

    log.debug(`Compiler loaded: ${this.#deltaEvents.length} files changed`);

    this.#sendEvent('state', { state: 'compile-start' });

    const deleteEvents = this.#deltaEvents.filter(event => event.type === 'delete');
    const createOrUpdateEvents = this.#deltaEvents.filter(event => event.type !== 'delete');

    if (deleteEvents.length) {
      for (const deleteEvent of deleteEvents) {
        if (this.#state.removeSource(deleteEvent.sourceFile)) {
          log.info(`Purging deleted output ${deleteEvent.sourceFile}`);
        }
      }
    }

    const metrics: CompileEmitEvent[] = [];
    const isCompilerChanged = createOrUpdateEvents.some(event => this.#state.isCompilerFile(event.sourceFile));
    const changedFiles = isCompilerChanged ? this.#state.getAllFiles() : createOrUpdateEvents.map(event => event.sourceFile);

    if (changedFiles.length) {
      for await (const event of this.emit(changedFiles)) {
        metrics.push(event);
      }
      if (this.#shutdownSignal.aborted) {
        log.debug('Compilation aborted');
      } else if (this.#state.hasErrors()) {
        const sortedFailures = this.#state.getAllErrors().sort((a, b) => a[0].localeCompare(b[0]));
        log.error(
          'Compilation failed',
          ['', sortedFailures.flatMap(([file, count]) => `- ${file}: ${count} errors found`)].flat(3).join('\n'),
          {
            phase: 'failure'
          }
        );
      } else {
        log.debug('Compilation succeeded');
      }

      // Rebuild manifests
      const manifest = await ManifestUtil.buildManifest(this.#state.manifestIndex.manifest);
      await ManifestUtil.writeManifest(manifest);
      await ManifestUtil.writeDependentManifests(manifest);

      if (this.#watch) {
        if (this.#state.hasErrors()) {
          this.#sendEvent('state', { state: 'compile-failed' });
        } else {
          this.#state.manifestIndex.reinitForModule(this.#state.manifest.main.name); // Reload
        }
      } else if (this.#state.hasErrors()) {
        this.#sendEvent('state', { state: 'compile-failed' });
        return this.#shutdown('error', `Compilation failed with ${this.#state.failureCount} errors`);
      }
    }

    this.#sendEvent('state', { state: this.#state.hasErrors() ? 'compile-failed' : 'compile-end' });

    if (process.env.TRV_BUILD === 'debug' && metrics.length) {
      this.logStatistics(metrics);
    }

    if (this.#watch && !this.#shutdownSignal.aborted) {
      const resolved = this.#state.getArbitraryInputFile();
      await this.#state.compileSourceFile(resolved);

      log.info('Watch is ready');

      this.#sendEvent('state', { state: this.#state.hasErrors() ? 'compile-failed' : 'watch-start' });
      try {
        for await (const event of new CompilerWatcher(this.#state, this.#shutdownSignal)) {
          await this.#onWatchEvent(event);
        }
        this.#sendEvent('state', { state: 'watch-end' });
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
