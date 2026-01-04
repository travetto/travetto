import type { CompilerClient } from '@travetto/compiler/support/server/client.ts';
import type { CompilerEventPayload, CompilerEventType } from '@travetto/compiler/support/types.ts';

import { AppError } from './error';
import { Util } from './util';
import { RuntimeIndex } from './manifest-index';
import { ShutdownManager } from './shutdown';
import { castTo } from './types';

type RetryRunState = {
  signal: AbortSignal;
  iteration: number;
  startTime: number;
  failureIterations: number;
  result?: 'error' | 'restart' | 'stop';
  retryExhausted?: boolean;
};

type RetryRunConfig = {
  maxRetries: number;
  maxRetryWindow: number;
  restartDelay: (config: RetryRunState) => number;
  onRestart: (config: RetryRunState) => (unknown | Promise<unknown>);
  onFailure: (config: RetryRunState) => (unknown | Promise<unknown>);
}

/**
 * Utilities for watching resources
 */
export class WatchUtil {

  static #cachedClient: CompilerClient | undefined = undefined;

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
  static async runWithRetry(run: (config: RetryRunState) => Promise<RetryRunState['result']>, options?: Partial<RetryRunConfig>): Promise<void> {
    const controller = new AbortController();
    const cleanup = ShutdownManager.onGracefulShutdown(controller.abort);

    const config: RetryRunConfig = {
      maxRetryWindow: 10 * 1000,
      maxRetries: 10,
      restartDelay: ({ failureIterations }) => failureIterations ? 100 : 10,
      onRestart: async () => { },
      onFailure: async (state) => { throw new AppError(`Operation failed after ${state.failureIterations} attempts`); },
      ...options,
    };

    const state: RetryRunState = {
      signal: controller.signal,
      iteration: 0,
      failureIterations: 0,
      startTime: Date.now()
    };

    while (!state.signal.aborted && !state.retryExhausted) {
      if (state.iteration > 0) {
        await Util.nonBlockingTimeout(config.restartDelay(state));
        await config.onRestart(state);
      }

      state.result = await run(state).catch(() => 'error' as 'error');
      switch (state.result) {
        case 'stop': controller.abort(); break;
        case 'error': state.failureIterations += 1; break;
        case 'restart': {
          state.startTime = Date.now();
          state.failureIterations = 0;
        }
      }

      state.retryExhausted = (state.failureIterations >= config.maxRetries) && (Date.now() - state.startTime >= config.maxRetryWindow);
      state.iteration += 1;
    }

    if (state.retryExhausted) {
      await config.onFailure(state);
    }

    cleanup?.();
  }

  /**  Watch compiler events  */
  static async watchCompilerEvents<K extends CompilerEventType, T extends CompilerEventPayload<K>>(
    type: K,
    onChange: (input: T) => unknown,
    options?: Partial<RetryRunConfig>,
  ): Promise<void> {
    const { CompilerClient } = await import('@travetto/compiler/support/server/client.ts');
    const client = this.#cachedClient ??= new CompilerClient(RuntimeIndex.manifest, {
      warn(message, ...args): void { console.error('warn', message, ...args); },
      debug(message, ...args): void { console.error('debug', message, ...args); },
      error(message, ...args): void { console.error('error', message, ...args); },
      info(message, ...args): void { console.error('info', message, ...args); }
    });

    return this.runWithRetry(async ({ signal }) => {
      await client.waitForState(['compile-end', 'watch-start'], undefined, signal);

      if (!await client.isWatching()) { // If we get here, without a watch
        return 'error';
      } else {
        for await (const event of client.fetchEvents(type, { signal: signal, enforceIteration: true })) {
          await onChange(castTo(event));
        }
        return 'restart';
      }
    }, options);
  }
}