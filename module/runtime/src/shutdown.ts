import { Env } from './env.ts';
import { Util } from './util.ts';
import { TimeUtil } from './time.ts';

/**
 * Shutdown manager, allowing for listening for graceful shutdowns
 */
export class ShutdownManager {

  static #registered = false;
  static #handlers: { scope?: string, handler: () => (void | Promise<void>) }[] = [];
  static #pending: (PromiseWithResolvers<void> & { time: number }) | undefined;
  static #controller = new AbortController();
  static signal: AbortSignal = this.#controller.signal;

  static #ensureExitListeners(): void {
    if (this.#registered) {
      return;
    }
    this.#registered = true;
    const cleanup = (signal: string): void => {
      if (this.#pending && (Date.now() - this.#pending.time) > 500) {
        console.warn('Shutdown already in progress, exiting immediately', { signal });
        process.exit(0); // Quit immediately
      }
      this.gracefulShutdown(signal).then(() => process.exit(0));
    };
    if (process.stdout.isTTY) {
      process.on('SIGINT', () => process.stdout.write('\n')); // Ensure we get a newline on ctrl-c
    }
    process.on('SIGUSR2', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
  }

  /**
   * On Shutdown requested
   * @param source The source of the shutdown request, for logging purposes
   * @param handler synchronous or asynchronous handler
   */
  static onGracefulShutdown(handler: () => (void | Promise<void>), scope?: string): () => void {
    this.#ensureExitListeners();
    this.#handlers.push({ handler, scope });
    return () => {
      const idx = this.#handlers.findIndex(item => item.handler === handler);
      if (idx >= 0) {
        this.#handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Wait for graceful shutdown to run and complete
   */
  static async gracefulShutdown(source: string): Promise<void> {
    if (this.#pending) {
      return this.#pending.promise;
    } else if (!this.#handlers.length) {
      return;
    }

    this.#pending = { ...Promise.withResolvers<void>(), time: Date.now() };

    await Util.queueMacroTask(); // Force the event loop to wait one cycle

    const timeout = TimeUtil.fromValue(Env.TRV_SHUTDOWN_WAIT.value) ?? 2000;
    const items = this.#handlers.splice(0, this.#handlers.length);
    console.debug('Graceful shutdown: started', { source, timeout, count: items.length });
    this.#controller.abort('Graceful shutdown initiated');

    const handlers = Promise.all(items.map(async ({ scope, handler }) => {
      if (scope) {
        console.debug('Stopping', { scope });
      }
      try {
        await handler();
        if (scope) {
          console.debug('Stopped', { scope });
        }
      } catch (error) {
        console.error('Error stopping', { error, scope });
      }
    }));

    const winner = await Promise.race([
      Util.nonBlockingTimeout(timeout).then(() => this), // Wait N seconds and then give up if not done
      handlers,
    ]);

    if (winner !== this) {
      console.debug('Graceful shutdown: completed');
    } else {
      console.debug('Graceful shutdown: timed-out', { timeout });
    }

    this.#pending.resolve();
  }
}