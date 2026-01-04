import { ChildProcess } from 'node:child_process';

import type { CompilerEventPayload, CompilerEventType } from '@travetto/compiler/support/types.ts';

import { AppError } from './error';
import { Util } from './util';
import { RuntimeIndex } from './manifest-index';
import { ShutdownManager } from './shutdown';
import { castTo } from './types';

type RetryRunState = {
  iteration: number;
  startTime: number;
  errorIterations: number;
  result?: 'error' | 'restart' | 'stop';
};

type RetryRunConfig = {
  maxRetries: number;
  maxRetryWindow: number;
  signal?: AbortSignal;
  onRetry: (state: RetryRunState, config: RetryRunConfig) => (unknown | Promise<unknown>);
};

/**
 * Utilities for watching resources
 */
export class WatchUtil {

  static #RESTART_EXIT_CODE = 200;

  /** Convert exit code to a result type  */
  static exitCodeToResult(code: number): RetryRunState['result'] {
    return code === this.#RESTART_EXIT_CODE ? 'restart' : code > 0 ? 'error' : 'stop';
  }

  /** Exit with a restart exit code */
  static exitWithRestart(): void {
    process.exit(this.#RESTART_EXIT_CODE);
  }

  /** Listen for restart signals */
  static listenForRestartSignal(): void {
    const listener = (event: unknown): void => {
      if (event === 'WATCH_RESTART') { this.exitWithRestart(); }
    };
    process.on('message', listener);
    ShutdownManager.onGracefulShutdown(() => { process.removeListener('message', listener); });
  }

  /** Trigger a restart signal to a subprocess */
  static triggerRestartSignal(subprocess?: ChildProcess): void {
    subprocess?.connected && subprocess.send?.('WATCH_RESTART');
  }

  /** Compute the delay before restarting */
  static computeRestartDelay(state: RetryRunState, config: RetryRunConfig): number {
    return state.result === 'error'
      ? config.maxRetryWindow / (config.maxRetries + 1)
      : 10;
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
  static async runWithRetry(run: (state: RetryRunState & { signal: AbortSignal }) => Promise<RetryRunState['result']>, options?: Partial<RetryRunConfig>): Promise<void> {
    const controller = new AbortController();
    const cleanup = ShutdownManager.onGracefulShutdown(() => controller.abort());
    let retryExhausted = false;

    const state: RetryRunState = {
      iteration: 0,
      errorIterations: 0,
      startTime: Date.now()
    };

    const config: RetryRunConfig = {
      maxRetryWindow: 10 * 1000,
      maxRetries: 10,
      onRetry: () => Util.nonBlockingTimeout(this.computeRestartDelay(state, config)),
      ...options,
    };


    while (!controller.signal.aborted && !retryExhausted) {
      if (state.iteration > 0) {
        await config.onRetry(state, config);
      }

      state.result = await run({ ...state, signal: controller.signal }).catch(() => 'error' as const);
      switch (state.result) {
        case 'stop': controller.abort(); break;
        case 'error': state.errorIterations += 1; break;
        case 'restart': {
          state.startTime = Date.now();
          state.errorIterations = 0;
        }
      }

      retryExhausted = (state.errorIterations >= config.maxRetries) || (Date.now() - state.startTime >= config.maxRetryWindow);
      state.iteration += 1;
    }

    if (retryExhausted) {
      throw new AppError(`Operation failed after ${state.errorIterations} attempts`);
    }

    cleanup?.();
  }

  /**  Watch compiler events  */
  static async watchCompilerEvents<K extends CompilerEventType, T extends CompilerEventPayload<K>>(
    type: K,
    onChange: (input: T) => unknown,
    filter?: (input: T) => boolean,
    options?: Partial<RetryRunConfig>,
  ): Promise<void> {
    const { CompilerClient } = await import('@travetto/compiler/support/server/client.ts');
    const client = new CompilerClient(RuntimeIndex.manifest, console);

    return this.runWithRetry(async ({ signal }) => {
      await client.waitForState(['compile-end', 'watch-start'], undefined, signal);

      if (!await client.isWatching()) { // If we get here, without a watch
        return 'error';
      } else {
        for await (const event of client.fetchEvents(type, { signal, enforceIteration: true })) {
          if (!filter || filter(castTo(event))) {
            await onChange(castTo(event));
          }
        }
        return 'restart';
      }
    }, options);
  }
}