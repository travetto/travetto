import { Env } from './env.ts';
import { Util } from './util.ts';
import { TimeUtil } from './time.ts';

/**
 * Shutdown manager, allowing for listening for graceful shutdowns
 */
export class ShutdownManager {
  static #registered = false;
  static #pending: unknown[] = [];
  static #controller = new AbortController();
  static #startedAt: number = 0;

  static {
    this.#controller = new AbortController();
    const addListener = this.#controller.signal.addEventListener.bind(this.#controller.signal);
    this.#controller.signal.addEventListener = (type: string, listener: (event: Event) => unknown): void => {
      this.#ensureExitListeners();
      return addListener(type, event => this.#pending.push(listener(event)));
    };
  }

  static get signal(): AbortSignal {
    return this.#controller.signal;
  }

  static #ensureExitListeners(): void {
    if (this.#registered) {
      return;
    }
    this.#registered = true;
    const cleanup = (source: string): void => {
      if (this.#startedAt && (Date.now() - this.#startedAt) > 500) {
        console.warn('Shutdown already in progress, exiting immediately', { source });
        process.exit(0); // Quit immediately
      }
      this.gracefulShutdown(source).then(() => process.exit(0));
    };
    if (process.stdout.isTTY) {
      process.on('SIGINT', () => process.stdout.write('\n')); // Ensure we get a newline on ctrl-c
    }
    process.on('SIGUSR2', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
  }

  /**
   * Wait for graceful shutdown to run and complete
   */
  static async gracefulShutdown(source: string): Promise<void> {
    this.#startedAt = Date.now();
    this.#controller.abort('Graceful shutdown: started');
    const timeout = TimeUtil.fromValue(Env.TRV_SHUTDOWN_WAIT.value) ?? 2000;
    console.debug('Graceful shutdown: started', { source, timeout });

    await Util.queueMacroTask(); // Force the event loop to wait one cycle

    const winner = await Promise.race([
      Util.nonBlockingTimeout(timeout).then(() => this), // Wait N seconds and then give up if not done
      Promise.all(this.#pending).then(() => null) // Wait for all handlers to complete,
    ]);

    if (winner !== this) {
      console.debug('Graceful shutdown: completed');
    } else {
      console.debug('Graceful shutdown: timed-out', { timeout });
    }
  }
}