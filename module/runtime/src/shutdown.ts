import type { ChildProcess } from 'node:child_process';

import { Env } from './env.ts';
import { Util } from './util.ts';
import { TimeUtil } from './time.ts';

const MAPPING = [['restart', 200], ['error', 1], ['quit', 0]] as const;
export type ShutdownReason = typeof MAPPING[number][0];

const REASON_TO_CODE = new Map<ShutdownReason, number>(MAPPING);
const CODE_TO_REASON = new Map<number, ShutdownReason>(MAPPING.map(([k, v]) => [v, k]));

type Handler = (event: Event) => unknown;
type ShutdownEvent = { reason?: ShutdownReason, mode?: 'exit' | 'interrupt' };

const isShutdownEvent = (event: unknown): event is ShutdownEvent =>
  typeof event === 'object' && event !== null && 'type' in event && event.type === 'shutdown';

const wrapped = async (handler: Handler): Promise<void> => {
  try {
    await handler(new Event('abort'));
  } catch (err) {
    console.error('Error during shutdown handler', err);
  }
};

/**
 * Shutdown manager, allowing for listening for graceful shutdowns
 */
export class ShutdownManager {
  static #shouldIgnoreInterrupt = false;
  static #registered = new Set<Handler>();
  static #controller = new AbortController();

  static {
    this.#controller.signal.addEventListener = (_: 'abort', listener: Handler): void => { this.#registered.add(listener); };
    this.#controller.signal.removeEventListener = (_: 'abort', listener: Handler): void => { this.#registered.delete(listener); };
    process
      .on('message', event => { isShutdownEvent(event) && this.shutdown(event); })
      .on('SIGINT', () => this.shutdown({ mode: 'interrupt' }))
      .on('SIGTERM', () => this.shutdown());
  }

  static get signal(): AbortSignal {
    return this.#controller.signal;
  }

  /** Disable SIGINT interrupt handling */
  static disableInterrupt(): typeof ShutdownManager {
    this.#shouldIgnoreInterrupt = true;
    return this;
  }

  /** Convert exit code to a reason string  */
  static reasonForExitCode(code: number): ShutdownReason {
    return CODE_TO_REASON.get(code) ?? 'error';
  }

  /** Trigger a watch signal signal to a subprocess */
  static async shutdownChild(subprocess: ChildProcess, config?: ShutdownEvent): Promise<void> {
    subprocess?.send!({ type: 'shutdown', ...config });
  }

  /**
   * Shutdown the application gracefully
   */
  static async shutdown({ reason = 'quit', mode = undefined }: ShutdownEvent = {}): Promise<void> {
    if ((mode === 'interrupt' && this.#shouldIgnoreInterrupt) || this.#controller.signal.aborted) {
      return;
    }

    process // Allow shutdown if anything is still listening
      .removeAllListeners('message')
      .removeAllListeners('SIGINT')
      .removeAllListeners('SIGTERM');

    if (mode === 'interrupt' && process.stdout.isTTY) {
      process.stdout.write('\n');
    }

    process.exitCode ??= REASON_TO_CODE.get(reason);

    const timeout = TimeUtil.fromValue(Env.TRV_SHUTDOWN_WAIT.value) ?? 2000;
    const context = { reason, mode, pid: process.pid, timeout, pending: this.#registered.size };
    this.#controller.abort('Shutdown started');
    console.debug('Shutdown started', context);

    const winner = await Promise.race([
      Util.nonBlockingTimeout(timeout).then(() => this),
      Promise.all([...this.#registered].map(wrapped))
    ]);

    if (winner !== this) {
      console.debug('Shutdown completed', context);
    } else {
      console.warn('Shutdown timed out', context);
    }

    if (mode === 'exit') {
      process.exit();
    }
  }
}