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
  static #registered = new Map<Handler, Handler>();
  static #pending: Function[] = [];
  static #controller = new AbortController();
  static #startedAt: number = 0;
  static #addListener = this.#controller.signal.addEventListener.bind(this.#controller.signal);
  static #removeListener = this.#controller.signal.removeEventListener.bind(this.#controller.signal);

  static {
    this.#controller.signal.addEventListener = (type: 'abort', listener: Handler): void => this.onGracefulShutdown(listener);
    this.#controller.signal.removeEventListener = (type: 'abort', listener: Handler): void => {
      this.#removeListener(type, this.#registered.get(listener) ?? listener);
    };
    process.on('message', event => {
      isShutdownEvent(event) && this.shutdown(event);
    });
  }

  static get signal(): AbortSignal {
    return this.#controller.signal;
  }

  static disableInterrupt(): typeof ShutdownManager {
    this.#shouldIgnoreInterrupt = true;
    return this;
  }

  /** Listen for graceful shutdown events */
  static onGracefulShutdown(listener: Handler): void {
    if (!this.#registered.size) {
      process
        .on('SIGINT', () => this.shutdown({ signal: 'SIGINT' }))
        .on('SIGUSR2', () => this.shutdown({ signal: 'SIGUSR2' }))
        .on('SIGTERM', () => this.shutdown({ signal: 'SIGTERM' }));
    }

    const wrappedListener: Handler = event => { this.#pending.push(() => listener(event)); };
    this.#registered.set(listener, wrappedListener);
    return this.#addListener('abort', wrappedListener);
  }

  /** Convert exit code to a reason string  */
  static reasonForExitCode(code: number): ShutdownReason {
    return CODE_TO_REASON.get(code) ?? 'error';
  }

  /** Trigger a watch signal signal to a subprocess */
  static async shutdownChild(subprocess: ChildProcess, config?: ShutdownEvent): Promise<number> {
    if (!subprocess) {
      return 0;
    }
    const result = new Promise<void>(resolve => subprocess.once('close', () => resolve()));
    subprocess.send!({ type: 'shutdown', ...config });
    await result;
    return subprocess.exitCode ?? 0;
  }

  /** Wait for pending tasks to complete */
  static async #waitForPendingTasks(event?: ShutdownEvent): Promise<void> {
    const context = { ...event, pid: process.pid };
    const timeout = TimeUtil.fromValue(Env.TRV_SHUTDOWN_WAIT.value) ?? 2000;
    const timeoutTasks = Util.nonBlockingTimeout(timeout).then(() => this);

    console.debug('Shutdown started', context, { pending: this.#pending.length });
    await Util.queueMacroTask();

    const allPendingTasks = Promise.all(this.#pending.map(fn => Promise.resolve(fn()).catch(err => {
      console.error('Error during shutdown task', err, context);
    })));

    const winner = await Promise.race([timeoutTasks, allPendingTasks]);
    if (winner !== this) {
      console.debug('Shutdown completed', context);
    } else {
      console.warn('Shutdown timed out', context);
    }
  }

  /** Begin the shutdown process */
  static #beginShutdown(event?: ShutdownEvent): void {
    process.removeAllListeners('message'); // Allow shutdown if anything is still listening

    if (event?.signal === 'SIGINT' && process.stdout.isTTY) {
      process.stdout.write('\n');
    }

    this.#controller.abort('Shutdown started');
    this.#startedAt = Date.now();
  }

  /** Complete shutdown after pending tasks completed */
  static async  #completeShutdown(event?: ShutdownEvent): Promise<void> {
    if (Env.TRV_SHUTDOWN_STDOUT_WAIT.isSet) {
      const stdoutDrain = TimeUtil.fromValue(Env.TRV_SHUTDOWN_STDOUT_WAIT.value)!;
      await Util.blockingTimeout(stdoutDrain);
    }

    if (event?.reason !== undefined) {
      const { reason } = event;
      process.exitCode = (typeof reason === 'string' ? REASON_TO_CODE.get(reason) : reason);
    }

    if (event?.exit) {
      process.exit();
    }
  }

  /** Should we run the shutdown process */
  static #shouldRunShutdown(event?: ShutdownEvent): boolean {
    const shutdownAlreadyStarted = this.#startedAt && (Date.now() - this.#startedAt) > 500;

    if (event?.signal === 'SIGINT' && this.#shouldIgnoreInterrupt) {
      return false;
    } else if (shutdownAlreadyStarted) {
      console.warn('Shutdown already in progress, exiting immediately', event);
      process.exit(0); // Quit immediately
    } else if (this.#controller.signal.aborted) {
      return false;
    }

    return true;
  }

  /**
   * Shutdown the application gracefully
   */
  static async shutdown(event?: ShutdownEvent): Promise<void> {
    if (!this.#shouldRunShutdown(event)) {
      return;
    }

    this.#beginShutdown(event);
    await this.#waitForPendingTasks(event);
    await this.#completeShutdown(event);
  }
}