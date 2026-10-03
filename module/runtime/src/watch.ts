import type { CompilerClient, CompilerEventPayload, CompilerEventType, CompilerLogEvent } from '@travetto/compiler';

import { RuntimeError } from './error.ts';
import { RuntimeIndex } from './manifest-index.ts';
import { ShutdownManager, type ShutdownReason } from './shutdown.ts';
import { castTo } from './types.ts';
import { Util } from './util.ts';

type RetryRunState = {
  iteration: number;
  startTime: number;
  errorIterations: number;
  result?: ShutdownReason;
};

type RetryRunConfig = {
  maxRetries: number;
  maxRetryWindow: number;
  signal?: AbortSignal;
  onRetry: (state: RetryRunState, config: RetryRunConfig) => unknown | Promise<unknown>;
};

export type CompilerWatchOptions = Partial<RetryRunConfig> & {
  waitForReady?: boolean;
  onInitial?: (client: CompilerClient) => unknown | Promise<unknown>;
};

/**
 * Utilities for watching resources
 */
export class WatchUtil {
  /** Compute the delay before restarting */
  static computeRestartDelay(state: RetryRunState, config: RetryRunConfig): number {
    return state.result === 'error' ? config.maxRetryWindow / (config.maxRetries + 1) : 10;
  }

  /**
   * Run with restart capability
   */
  static async runWithRetry(
    run: (state: RetryRunState & { signal: AbortSignal }) => Promise<ShutdownReason>,
    options?: Partial<RetryRunConfig>
  ): Promise<void> {
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
      ...options
    };

    outer: while (!ShutdownManager.signal.aborted && !retryExhausted) {
      if (state.iteration > 0) {
        await config.onRetry(state, config);
      }

      state.result = await run({ ...state, signal: ShutdownManager.signal }).catch(() => 'error' as const);
      switch (state.result) {
        case 'quit':
          break outer;
        case 'error':
          state.errorIterations += 1;
          break;
        case 'restart': {
          state.startTime = Date.now();
          state.errorIterations = 0;
        }
      }

      retryExhausted = state.errorIterations >= config.maxRetries || Date.now() - state.startTime >= config.maxRetryWindow;
      state.iteration += 1;
    }

    if (retryExhausted) {
      throw new RuntimeError(`Operation failed after ${state.errorIterations} attempts`);
    }
  }

  static async #getCompilerClient(): Promise<CompilerClient> {
    const { CompilerClient: ClientClass } = await import('@travetto/compiler/src/server/client.ts');
    return new ClientClass(RuntimeIndex.manifest, {
      debug: (...args: unknown[]): void => console.debug(...args),
      info: (...args: unknown[]): void => console.info(...args),
      warn: (...args: unknown[]): void => console.warn(...args),
      error: (...args: unknown[]): void => console.error(...args)
    });
  }

  /**  Watch compiler events  */
  static async watchCompilerEvents<K extends CompilerEventType, T extends CompilerEventPayload<K>>(
    type: K,
    onChange: (input: T) => unknown,
    filter?: (input: T) => boolean,
    options?: CompilerWatchOptions
  ): Promise<void> {
    const client = await this.#getCompilerClient();

    // pre-check
    if (!(await client.isWatching())) {
      throw new RuntimeError('Compile Server is not running');
    }

    await options?.onInitial?.(client);

    void this.runWithRetry(async ({ signal }) => {
      if (options?.waitForReady ?? true) {
        await client.waitForState(['watch-start'], undefined, signal);
      }

      if (!(await client.isWatching())) {
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

  /** Stream and render compiler logs */
  static async watchCompilerLogs(filter?: (event: CompilerLogEvent) => boolean, options?: CompilerWatchOptions): Promise<void> {
    const { Log } = await import('@travetto/compiler/src/log.ts');
    await this.watchCompilerEvents('log', event => Log.render(event), filter, {
      waitForReady: false,
      onInitial: async client => {
        const info = await client.info();
        const messages = [...(info?.messages?.reset ?? []), ...(info?.messages?.error ?? []), ...(info?.messages?.failure ?? [])];
        for (const message of messages) {
          if (!filter || filter(message)) {
            Log.render(message);
          }
        }
      },
      ...options
    });
  }

  /**
   * Wait for compiler to be watch-ready, pausing if in a failed compilation state
   */
  static async pauseUntilWatchReady(signal?: AbortSignal): Promise<void> {
    const client = await this.#getCompilerClient();
    if (!(await client.waitForWatchReady(signal))) {
      if (signal?.aborted) {
        return;
      }
      console.error('[compiler-watch] Compilation failed. Pausing until errors are resolved...');
      await client.waitForState(['watch-start'], undefined, signal);
      if (signal?.aborted) {
        return;
      }
      console.error('[compiler-watch] Compilation resolved. Resuming...');
    }
  }
}
