import { Env } from './env.ts';
import { Util } from './util.ts';
import { TimeUtil } from './time.ts';

type Handler = (event: Event) => unknown;

/**
 * Shutdown manager, allowing for listening for graceful shutdowns
 */
export class ShutdownManager {
  static #registered = false;
  static #pending: unknown[] = [];
  static #controller = new AbortController();
  static #startedAt: number = 0;
  static #addListener = this.#controller.signal.addEventListener.bind(this.#controller.signal);

  static {
    this.#controller.signal.addEventListener = (type: 'abort', listener: Handler): void => this.onGracefulShutdown(listener);
  }

  static get signal(): AbortSignal {
    return this.#controller.signal;
  }

  static onGracefulShutdown(listener: Handler): void {
    if (!this.#registered) {
      this.#registered = true;
      process
        .on('SIGINT', () => process.stdout.isTTY && process.stdout.write('\n')) // Ensure we get a newline on ctrl-c
        .on('SIGUSR2', () => this.shutdown('SIGUSR2'))
        .on('SIGTERM', () => this.shutdown('SIGTERM'))
        .on('SIGINT', () => this.shutdown('SIGINT'));
    }

    return this.#addListener('abort', event =>
      this.#pending.push(
        Promise.resolve(listener(event)).catch(err => {
          console.error('Error during shutdown handler', err);
        })
      )
    );
  }

  /**
   * Shutdown the application gracefully
   */
  static async shutdown(source?: string): Promise<void> {
    if (this.#startedAt && (Date.now() - this.#startedAt) > 500) {
      console.warn('Shutdown already in progress, exiting immediately', { source });
      process.exit(0); // Quit immediately
    } else if (this.#controller.signal.aborted) {
      return;
    }

    const timeout = TimeUtil.fromValue(Env.TRV_SHUTDOWN_WAIT.value) ?? 2000;
    const stdoutDrain = TimeUtil.fromValue(Env.TRV_SHUTDOWN_STDOUT_WAIT.value)!;
    const context = { ...source ? { source } : {}, timeout };
    this.#startedAt = Date.now();
    this.#controller.abort('Shutdown started');
    await Util.queueMacroTask(); // Force the event loop to wait one cycle

    console.debug('Shutdown started', context);

    if (stdoutDrain) {
      this.#pending.push(Util.blockingTimeout(stdoutDrain));
    }

    const timedOut = await Promise.race([
      Util.nonBlockingTimeout(timeout).then(() => true), // Wait N seconds and then give up if not done
      Promise.all(this.#pending).then(() => false) // Wait for all handlers to complete,
    ]);

    if (!timedOut) {
      console.debug('Shutdown completed', context);
    } else {
      console.warn('Shutdown timed out', context);
    }

    process.exit(0);
  }
}