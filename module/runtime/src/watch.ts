import type { CompilerClient } from '@travetto/compiler/support/server/client.ts';
import { AppError } from './error';
import { Util } from './util';
import { RuntimeIndex } from './manifest-index';
import type { CompilerChangeEvent, FileChangeEvent } from 'module/compiler/support/types';
import { ShutdownManager } from './shutdown';

export type RunResult = 'error' | 'restart' | 'stop';

type RunState = {
  signal: AbortSignal;
  iteration: number;
  startTime: number;
  failureIterations: number;
  result?: RunResult;
  retryExhausted?: boolean;
};

export type RunWithResultOptions = {
  maxRetries?: number;
  maxRetryWindow?: number;
  run: (config: RunState) => Promise<RunResult>;
  restartDelay?: number | ((config: RunState) => number);
  onRestart?: (config: RunState) => (unknown | Promise<unknown>);
  onFailure?: (config: RunState) => (unknown | Promise<unknown>);
  registerShutdown?: (stop: () => void) => Function;
}

type WatchOptions = Pick<RunWithResultOptions, 'onRestart' | 'maxRetryWindow' | 'maxRetries'>;

/**
 * Utilities for watching resources
 */
export class WatchUtil {

  static #cachedClient: Promise<CompilerClient> | undefined = undefined;
  static #getClient(): Promise<CompilerClient> {
    return this.#cachedClient ??= import('@travetto/compiler/support/server/client.ts').then(async module => {
      return new module.CompilerClient(RuntimeIndex.manifest, {
        warn(message, ...args): void { console.error('warn', message, ...args); },
        debug(message, ...args): void { console.error('debug', message, ...args); },
        error(message, ...args): void { console.error('error', message, ...args); },
        info(message, ...args): void { console.error('info', message, ...args); }
      });
    });
  }

  static async #streamSource<T>(config: { source: AsyncIterable<T>, onChange: (input: T) => unknown, signal: AbortSignal, filter?: (input: T) => boolean }): Promise<RunResult> {
    const client = await this.#getClient();
    await client.waitForState(['compile-end', 'watch-start'], undefined, config.signal);

    if (!await client.isWatching()) { // If we get here, without a watch
      return 'error';
    } else {
      for await (const event of config.source) {
        if (config.filter === undefined || config.filter(event)) {
          await config.onChange(event);
        }
      }
      return 'restart';
    }
  }

  /**
   * Retry an operation, with a custom conflict handler
   * @param operation The operation to retry
   * @param isHandledConflict Function to determine if the error is a handled conflict
   * @param maxTries Maximum number of retries
   */
  static async acquireWithRetry<T>(
    operation: () => T | Promise<T>,
    prepareRetry: (error: unknown, count: number) => (void | undefined | boolean | Promise<(void | undefined | boolean)>),
    maxTries = 5,
  ): Promise<T> {
    for (let i = 0; i < maxTries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxTries - 1 || await prepareRetry(error, i) === false) {
          throw error; // Stop retrying if we reached max tries or prepareRetry returns false
        }
      }
    }

    throw new AppError(`Operation failed after ${maxTries} attempts`);
  }

  /**
   * Run with restart capability
   */
  static async runWithRestart(config: RunWithResultOptions): Promise<void> {
    const controller = new AbortController();
    const maxRetryWindow = config?.maxRetryWindow ?? (10 * 1000) // 10 seconds default;
    const maxRetries = config?.maxRetries ?? 10; // 10 retries default;
    const restartDelay = typeof config.restartDelay === 'function' ? config.restartDelay : () => (config.restartDelay as number) ?? 100;
    const cleanup = config.registerShutdown?.(() => controller.abort()) ?? undefined;
    const state: RunState = { signal: controller.signal, iteration: 0, failureIterations: 0, startTime: Date.now() };

    while (!state.signal.aborted && !state.retryExhausted) {

      if (state.iteration > 0) {
        await Util.nonBlockingTimeout(restartDelay(state));
        await config?.onRestart?.(state);
      }

      state.result = await config.run(state).catch(() => 'error' as 'error');
      switch (state.result) {
        case 'stop': controller.abort(); break;
        case 'error': state.failureIterations += 1; break;
        case 'restart': {
          state.startTime = Date.now();
          state.failureIterations = 0;
        }
      }

      state.retryExhausted = (state.failureIterations >= maxRetries) &&
        (Date.now() - state.startTime >= maxRetryWindow);
      state.iteration += 1;
    }

    if (state.retryExhausted) {
      await config?.onFailure?.(state);
    }

    cleanup?.();
  }

  /**  Watch compiler for source code changes */
  static async watchCompiler(onChange: (input: CompilerChangeEvent) => unknown, options?: WatchOptions): Promise<void> {
    const client = await this.#getClient();
    return WatchUtil.runWithRestart({
      ...options,
      registerShutdown: stop => ShutdownManager.onGracefulShutdown(stop),
      restartDelay: ({ failureIterations }) => 100 * failureIterations + 10,
      run: ({ signal }) => this.#streamSource({
        source: client.fetchEvents('change', { signal, enforceIteration: true }),
        onChange,
        signal,
        filter: event => !!(event.import || RuntimeIndex.findModuleForArbitraryFile(event.file))
      })
    });
  }

  /** Watch for any file changes */
  static async watchFiles(onChange: (input: FileChangeEvent) => unknown, options?: WatchOptions): Promise<void> {
    const client = await this.#getClient();
    return WatchUtil.runWithRestart({
      ...options,
      registerShutdown: stop => ShutdownManager.onGracefulShutdown(stop),
      restartDelay: ({ failureIterations }) => 100 * failureIterations + 10,
      run: ({ signal }) => this.#streamSource({
        source: client.fetchEvents('file', { signal, enforceIteration: true }),
        onChange,
        signal
      }),
    });
  }
}