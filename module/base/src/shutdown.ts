import { ModuleUtil } from '@travetto/boot/src/internal/module-util';

import { Util } from './util';
import { AppManifest } from './manifest';

const ogExit = process.exit;

export type Closeable = {
  close(cb?: Function): unknown;
  name?: string;
};

type UnhandledHandler = (err: Error, prom?: Promise<unknown>) => boolean | undefined | void;
type Listener = { name: string, handler: Function, final?: boolean };

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

  async #getAvailableListeners(exitCode: number) {
    const promises: Promise<unknown>[] = [];

    // Get valid listeners depending on lifecycle
    const listeners = this.#listeners.filter(x => exitCode >= 0 || !x.final);

    // Retain unused listeners for final attempt, if needed
    this.#listeners = this.#listeners.filter(x => exitCode < 0 && x.final);

    // Handle each listener
    for (const listener of listeners) {
      const { name, handler } = listener;

      try {
        console.debug('Starting', { name });
        const res = handler();
        if (res && res.then) {
          // If a promise, queue for handling
          promises.push(res as Promise<unknown>);
          res
            .then(() => console.debug('Completed', { name }))
            .catch((e: unknown) => console.error('Failed', { error: e, name }));
        } else {
          console.debug('Completed', { name });
        }
      } catch (e) {
        console.error('Failed', { name, error: e });
      }
    }

    return promises;
  }

  async executeAsync(exitCode: number = 0, err?: unknown) {

    if (this.#shutdownCode > 0) { // Killed twice
      if (exitCode > 0) { // Handle force kill
        ogExit(exitCode);
      } else {
        return;
      }
    } else {
      this.#shutdownCode = exitCode;
    }

    try {
      // If the err is not an exit code
      if (err && typeof err !== 'number') {
        console.warn('Error on shutdown', { error: err });
      }

      // Get list of all pending listeners
      const promises = await this.#getAvailableListeners(exitCode);

      // Run them all, with the ability for the shutdown to preempt
      if (promises.length) {
        const finalRun = Promise.race([
          ...promises,
          Util.wait(AppManifest.env.shutdownWait).then(() => { throw new Error('Timeout on shutdown'); })
        ]);
        await finalRun;
      }

    } catch (e) {
      console.warn('Error on shutdown', { error: e });
    }

    if (this.#shutdownCode >= 0) {
      ogExit(this.#shutdownCode);
    }
  }

  /**
   * Begin shutdown process with a given exit code and possible error
   */
  execute(exitCode: number = 0, err?: unknown) {
    this.executeAsync(exitCode, err); // Fire and forget
  }

  /**
   * Hook into the process to override the shutdown behavior
   */
  register() {
    process.exit = this.execute.bind(this) as (() => never); // NOTE: We do not actually throw an error the first time, to allow for graceful shutdown
    process.on('exit', this.execute.bind(this));
    process.on('SIGINT', this.execute.bind(this, 130));
    process.on('SIGTERM', this.execute.bind(this, 143));
    process.on('uncaughtException', (err) => this.#unhandled.find(x => !!x(err as Error)));
    process.on('unhandledRejection', (err, p) => this.#unhandled.find(x => !!x(err as Error, p)));
    this.#unhandled.push(this.execute.bind(this, 1));
  }

  /**
   * Register to handle closeable on shutdown
   * @param closeable
   */
  onShutdown(closeable: Closeable): void;
  /**
   * Register a shutdown handler
   * @param name  Name to log
   * @param handler Actual code
   * @param final If this should be run an attempt to shutdown or only on the final shutdown
   */
  onShutdown(name: string, handler: Function, final?: boolean): void;
  onShutdown(nameOrCloseable: string | Closeable, handler?: Function, final = false) {
    let name: string;
    if (typeof nameOrCloseable !== 'string') {
      name = nameOrCloseable.name ?? nameOrCloseable.constructor.name;
      handler = nameOrCloseable.close.bind(nameOrCloseable);
    } else {
      name = nameOrCloseable;
      handler = handler!;
    }
    if (/[.][jt]s$/.test(name)) {
      name = ModuleUtil.getId(name);
    }
    this.#listeners.push({ name, handler, final });
  }

  /**
   * Listen for unhandled exceptions
   * @param handler Listener for all uncaught exceptions if valid
   * @param position Handler list priority
   */
  onUnhandled(handler: UnhandledHandler, position = -1) {
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
  removeUnhandledHandler(handler: UnhandledHandler) {
    const index = this.#unhandled.indexOf(handler);
    if (index >= 0) {
      this.#unhandled.splice(index, 1);
    }
  }

  /**
   * Listen for an unhandled event, as a promise
   */
  listenForUnhandled(): Promise<void> & { cancel: () => void } {
    const uncaught = Util.resolvablePromise() as ReturnType<(typeof Util)['resolvablePromise']> & { cancel?: () => void };
    const cancel = this.onUnhandled(err => { uncaught.reject(err); return true; }, 0);
    uncaught.cancel = () => {
      cancel(); // Remove the handler
      uncaught.resolve(); // Close the promise
    };
    return uncaught as Promise<void> & { cancel: () => void };
  }

  /**
   * Wraps a function to capture unhandled exceptions for a period of time.
   * Converts uncaught exception to a thrown error
   * @param fn The function to wrap
   */
  async captureUnhandled<U>(fn: Function): Promise<U> {
    const uncaught = this.listenForUnhandled();
    try {
      return (await Promise.race([uncaught, fn()])) as U;
    } finally {
      uncaught.cancel();
    }
  }
}

export const ShutdownManager = new $ShutdownManager();