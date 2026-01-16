import type { ChildProcess } from 'node:child_process';

import { Env } from './env.ts';
import { Util } from './util.ts';
import { TimeUtil } from './time.ts';

type Handler = (event: Event) => unknown;
export type ShutdownReason = 'restart' | 'error' | 'quit';
type ShutdownSignal = 'SIGINT' | 'SIGTERM' | 'SIGUSR2' | string | undefined;
type ShutdownEvent = { signal?: ShutdownSignal, reason?: ShutdownReason | number, exit?: boolean };

const isShutdownEvent = (event: unknown): event is ShutdownEvent =>
  typeof event === 'object' && event !== null && 'type' in event && event.type === 'shutdown';

const RESTART_EXIT_CODE = 200;

const REASON_TO_CODE = new Map<ShutdownReason, number>([
  ['restart', RESTART_EXIT_CODE],
  ['error', 1],
  ['quit', 0],
]);
const CODE_TO_REASON = new Map<number, ShutdownReason>([
  [RESTART_EXIT_CODE, 'restart'],
  [1, 'error'],
  [0, 'quit'],
]);

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
      .on('SIGINT', () => this.shutdown({ signal: 'SIGINT' }))
      .on('SIGUSR2', () => this.shutdown({ signal: 'SIGUSR2' }))
      .on('SIGTERM', () => this.shutdown({ signal: 'SIGTERM' }));
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

  /** Wait for pending tasks to complete */
  static async #runShutdown(event?: ShutdownEvent): Promise<void> {
    const context = { ...event, pid: process.pid };

    this.#controller.abort('Shutdown started');
    console.debug('Shutdown started', context, { pending: this.#registered.size });
    await Util.queueMacroTask();

    const timeout = TimeUtil.fromValue(Env.TRV_SHUTDOWN_WAIT.value) ?? 2000;
    const allPendingTasks = Promise.all([...this.#registered].map(async handler => {
      try {
        await handler(null!);
      } catch (err) {
        console.warn('Error during shutdown handler', err,);
      }
    }));
    const timeoutTasks = Util.nonBlockingTimeout(timeout).then(() => this);
    const winner = await Promise.race([timeoutTasks, allPendingTasks]);

    if (winner !== this) {
      console.debug('Shutdown completed', context);
    } else {
      console.warn('Shutdown timed out', context);
    }
  }

  /**
   * Shutdown the application gracefully
   */
  static async shutdown(event?: ShutdownEvent): Promise<void> {
    if ((event?.signal === 'SIGINT' && this.#shouldIgnoreInterrupt) || this.#controller.signal.aborted) {
      return;
    }

    process // Allow shutdown if anything is still listening
      .removeAllListeners('message')
      .removeAllListeners('SIGINT')
      .removeAllListeners('SIGTERM')
      .removeAllListeners('SIGUSR2');

    if (event?.signal === 'SIGINT' && process.stdout.isTTY) {
      process.stdout.write('\n');
    }

    if (event?.reason !== undefined) {
      const { reason } = event;
      process.exitCode = (typeof reason === 'string' ? REASON_TO_CODE.get(reason) : reason);
    }

    await this.#runShutdown(event);

    if (event?.exit) {
      process.exit();
    }
  }
}