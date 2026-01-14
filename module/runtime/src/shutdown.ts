import { Env } from './env.ts';
import { Util } from './util.ts';
import { TimeUtil } from './time.ts';

type Handler = (event: Event) => unknown;

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
  }

  static get signal(): AbortSignal {
    return this.#controller.signal;
  }

  static disableInterrupt(): void {
    this.#shouldIgnoreInterrupt = true;
  }

  static onGracefulShutdown(listener: Handler): void {
    if (!this.#registered.size) {
      process
        .on('SIGINT', () => this.shutdown('SIGINT')) // Ensure we get a newline on ctrl-c
        .on('SIGUSR2', () => this.shutdown('SIGUSR2'))
        .on('SIGTERM', () => this.shutdown('SIGTERM'));
    }

    const wrappedListener: Handler = event => { this.#pending.push(() => listener(event)); };
    this.#registered.set(listener, wrappedListener);
    return this.#addListener('abort', wrappedListener);
  }

  /**
   * Shutdown the application gracefully
   */
  static async shutdown(source?: string, code?: number): Promise<void> {
    if (this.#shouldIgnoreInterrupt && source === 'SIGINT') {
      return;
    }
    if (this.#controller.signal.aborted) {
      if (this.#startedAt && (Date.now() - this.#startedAt) > 500) {
        console.warn('Shutdown already in progress, exiting immediately', { source });
        process.exit(0); // Quit immediately
      } else {
        return;
      }
    }

    if (process.stdout.isTTY) {
      process.stdout.write('\n');
    }

    process.removeAllListeners('message'); // Allow shutdown if anything is still listening

    const context = source ? [{ source, pid: process.pid }] : [{ pid: process.pid }];
    this.#startedAt = Date.now();
    this.#controller.abort('Shutdown started');
    await Util.queueMacroTask(); // Force the event loop to wait one cycle

    console.debug('Shutdown started', ...context, { pending: this.#pending.length });

    const timeout = TimeUtil.fromValue(Env.TRV_SHUTDOWN_WAIT.value) ?? 2000;
    const timeoutTasks = Util.nonBlockingTimeout(timeout).then(() => this);
    const allPendingTasks = Promise.all(this.#pending.map(fn => Promise.resolve(fn()).catch(err => {
      console.error('Error during shutdown task', err, ...context);
    })));

    const timedOut = await Promise.race([timeoutTasks, allPendingTasks]);

    process.exitCode = code ?? process.exitCode ?? 0;

    if (timedOut !== this) {
      console.debug('Shutdown completed', ...context);
    } else {
      console.warn('Shutdown timed out', ...context);
    }

    if (Env.TRV_SHUTDOWN_STDOUT_WAIT.isSet) {
      const stdoutDrain = TimeUtil.fromValue(Env.TRV_SHUTDOWN_STDOUT_WAIT.value)!;
      await Util.blockingTimeout(stdoutDrain);
    }

    process.exit();
  }
}