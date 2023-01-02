import { setTimeout } from 'timers/promises';

import { RootIndex } from '@travetto/manifest';
import { Env } from './env';

export type Closeable = {
  close(cb?: Function): unknown;
};

type UnhandledHandler = (err: Error, prom?: Promise<unknown>) => boolean | undefined | void;
type Listener = { name: string, handler: Function, final?: boolean };

function isPromise(a: unknown): a is Promise<unknown> {
  return !!a && (a instanceof Promise || (typeof a === 'object') && 'then' in a);
}

/**
 * Shutdown manager, allowing for hooks into the shutdown process.
 *
 * On a normal shutdown signal (SIGINT, SIGTERM), the shutdown manager
 * will start a timer, and begin executing the shutdown handlers.
 *
 * The handlers should be synchronous and fast, as once a threshold timeout
 * has been hit, the application will force kill itself.
 *
 * If the application receives another SIGTERM/SIGINT while shutting down,
 * it will shutdown immediately.
 */
class $ShutdownManager {
  #listeners: Listener[] = [];
  #shutdownCode = -1;
  #unhandled: UnhandledHandler[] = [];
  #exit = process.exit;

  async #getAvailableListeners(exitCode: number): Promise<unknown[]> {
    const promises: Promise<unknown>[] = [];

    // Get valid listeners depending on lifecycle
    const listeners = this.#listeners.filter(x => exitCode >= 0 || !x.final);

    // Retain unused listeners for final attempt, if needed
    this.#listeners = this.#listeners.filter(x => exitCode < 0 && x.final);

    // Handle each listener
    for (const listener of listeners) {
      const { name, handler } = listener;

      try {
        if (name) {
          console.debug('Starting', { name });
        }
        const res = handler();
        if (isPromise(res)) {
          // If a promise, queue for handling
          promises.push(res);
          if (name) {
            res.then(() => console.debug('Completed', { name }));
          }
          res.catch((err: unknown) => console.error('Failed', { error: err, name }));
        } else {
          if (name) {
            console.debug('Completed', { name });
          }
        }
      } catch (err) {
        console.error('Failed', { name, error: err });
      }
    }

    return promises;
  }

  async executeAsync(exitCode: number = 0, exitErr?: unknown): Promise<void> {

    if (this.#shutdownCode > 0) { // Killed twice
      if (exitCode > 0) { // Handle force kill
        this.#exit(exitCode);
      } else {
        return;
      }
    } else {
      this.#shutdownCode = exitCode;
    }

    const name = RootIndex.mainPackage.name;

    try {
      // If the err is not an exit code
      if (exitErr && typeof exitErr !== 'number') {
        console.warn('Error on shutdown', { package: name, error: exitErr });
      }

      // Get list of all pending listeners
      const promises = await this.#getAvailableListeners(exitCode);

      // Run them all, with the ability for the shutdown to preempt
      if (promises.length) {
        const waitTime = Env.getInt('TRV_SHUTDOWN_WAIT', 2000);
        const finalRun = Promise.race([
          ...promises,
          setTimeout(waitTime).then(() => { throw new Error('Timeout on shutdown'); })
        ]);
        await finalRun;
      }

    } catch (err) {
      console.warn('Error on shutdown', { package: name, error: err });
    }

    if (this.#shutdownCode >= 0) {
      this.#exit(this.#shutdownCode);
    }
  }

  /**
   * Begin shutdown process with a given exit code and possible error
   */
  execute(exitCode: number = 0, err?: unknown): void {
    this.executeAsync(exitCode, err); // Fire and forget
  }

  /**
   * Execute unhandled behavior
   */
  executeUnhandled(err: Error, value?: Promise<unknown>): void {
    for (const handler of this.#unhandled) {
      if (handler(err, value)) {
        return;
      }
    }
    this.execute(1, err);
  }

  /**
   * Hook into the process to override the shutdown behavior
   */
  register(): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    process.exit = this.execute.bind(this) as (() => never); // NOTE: We do not actually throw an error the first time, to allow for graceful shutdown
    process.on('exit', this.execute.bind(this));
    process.on('SIGINT', this.execute.bind(this, 130));
    process.on('SIGTERM', this.execute.bind(this, 143));
    process.on('uncaughtException', this.executeUnhandled.bind(this));
    process.on('unhandledRejection', this.executeUnhandled.bind(this));
  }

  /**
   * Register a shutdown handler
   * @param name  Class/Function to log for
   * @param handler Handler or Closeable
   * @param final If this should be run an attempt to shutdown or only on the final shutdown
   */
  onShutdown(src: undefined | string | Function | { constructor: Function }, handler: Function | Closeable, final: boolean = false): () => void {
    if ('close' in handler) {
      handler = handler.close.bind(handler);
    }
    const name = typeof src === 'undefined' ? '' : (typeof src === 'string' ? src : ('Ⲑid' in src ? src.Ⲑid : src.constructor.Ⲑid));
    this.#listeners.push({ name, handler, final });
    return () => this.#listeners.splice(this.#listeners.findIndex(e => e.handler === handler), 1);
  }

  /**
   * Listen for unhandled exceptions
   * @param handler Listener for all uncaught exceptions if valid
   * @param position Handler list priority
   */
  onUnhandled(handler: UnhandledHandler, position = -1): () => void {
    if (position < 0) {
      this.#unhandled.push(handler);
    } else {
      this.#unhandled.splice(position, 0, handler);
    }
    return this.removeUnhandledHandler.bind(this, handler);
  }

  /**
   * Remove handler for unhandled exceptions
   * @param handler The handler to remove
   */
  removeUnhandledHandler(handler: UnhandledHandler): void {
    const index = this.#unhandled.indexOf(handler);
    if (index >= 0) {
      this.#unhandled.splice(index, 1);
    }
  }
}

export const ShutdownManager = new $ShutdownManager();