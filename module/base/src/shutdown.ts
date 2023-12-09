import timers from 'node:timers/promises';

import { Env } from './env';

/**
 * Shutdown manager, allowing for listening for graceful shutdowns
 */
export class ShutdownManager {

  static #registered = false;
  static #handlers: { name?: string, handler: () => Promise<void> }[] = [];

  /**
   * On Shutdown requested
   * @param name name to log for
   * @param handler synchronous or asynchronous handler
   */
  static onGracefulShutdown(handler: () => Promise<void>, name?: string | { constructor: { Ⲑid: string } }): () => void {
    if (!this.#registered) {
      this.#registered = true;
      const done = (): void => { this.gracefulShutdown(0); };
      process.on('SIGUSR2', done).on('SIGTERM', done).on('SIGINT', done);
    }
    this.#handlers.push({ handler, name: typeof name === 'string' ? name : name?.constructor.Ⲑid });
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
  static async gracefulShutdown(code?: number): Promise<void> {
    if (this.#handlers.length) {
      console.debug('Graceful shutdown: started');

      const items = this.#handlers.splice(0, this.#handlers.length);
      const handlers = Promise.all(items.map(({ name, handler }) => {
        if (name) {
          console.debug('Stopping', { name });
        }
        return handler().catch(err => {
          console.error('Error shutting down', { name, err });
        });
      }));

      await Promise.race([
        timers.setTimeout(Env.TRV_SHUTDOWN_WAIT.time ?? 2000), // Wait 2s and then force finish
        handlers,
      ]);

      console.debug('Graceful shutdown: completed');
    }
    if (code !== undefined) {
      process.exit(code);
    }
  }
}