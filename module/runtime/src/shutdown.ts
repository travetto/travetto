import { Env } from './env.ts';
import { Util } from './util.ts';
import { TimeUtil } from './time.ts';

/**
 * Shutdown manager, allowing for listening for graceful shutdowns
 */
export class ShutdownManager {

  static #registered = false;
  static #handlers: { name?: string, handler: () => (void | Promise<void>) }[] = [];

  /**
   * On Shutdown requested
   * @param name name to log for
   * @param handler synchronous or asynchronous handler
   */
  static onGracefulShutdown(handler: () => (void | Promise<void>), name?: string | { constructor: Function }): () => void {
    if (!this.#registered) {
      this.#registered = true;
      process
        .on('SIGUSR2', () => this.gracefulShutdown('SIGUSR2', 0))
        .on('SIGTERM', () => this.gracefulShutdown('SIGTERM', 0))
        .on('SIGINT', () => this.gracefulShutdown('SIGINT', 0));
    }
    this.#handlers.push({ handler, name: typeof name === 'string' ? name : name?.constructor?.Ⲑid });
    return () => {
      const idx = this.#handlers.findIndex(x => x.handler === handler);
      if (idx >= 0) {
        this.#handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Wait for graceful shutdown to run and complete
   */
  static async gracefulShutdown(source: string, code?: number): Promise<void> {
    await Util.queueMacroTask(); // Force the event loop to wait one cycle

    if (this.#handlers.length) {
      if (source === 'SIGINT') { // If we are shutting down due to SIGINT, break away from the ctrl c
        process.stdout.write('\n');
      }

      console.debug('Graceful shutdown: started', { source });

      const items = this.#handlers.splice(0, this.#handlers.length);
      const handlers = Promise.all(items.map(async ({ name, handler }) => {
        if (name) {
          console.debug('Stopping', { name });
        }
        try {
          return await handler();
        } catch (err) {
          console.error('Error shutting down', { name, err });
        }
      }));

      await Promise.race([
        Util.nonBlockingTimeout(TimeUtil.fromValue(Env.TRV_SHUTDOWN_WAIT.val) ?? 2000), // Wait 2s and then force finish
        handlers,
      ]);

      console.debug('Graceful shutdown: completed');
    }
    if (code !== undefined) {
      process.exit(code);
    }
  }
}