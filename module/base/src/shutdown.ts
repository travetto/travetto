import { EnvUtil } from '@travetto/boot';
import { Util } from './util';

const ogExit = process.exit;

const SHUTDOWN_WAIT = EnvUtil.getTime('TRV_SHUTDOWN_WAIT', 2000);

type UnhandledHandler = (err: Error, prom?: Promise<any>) => boolean | undefined | void;
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
export class ShutdownManager {
  private static listeners: Listener[] = [];
  private static shutdownCode = -1;
  private static unhandled: UnhandledHandler[] = [];

  private static async getAvailableListeners(exitCode: number) {
    const promises: Promise<any>[] = [];

    // Get valid listeners depending on lifecycle
    const listeners = this.listeners.filter(x => exitCode >= 0 || !x.final);

    // Retain unused listeners for final attempt, if needed
    this.listeners = this.listeners.filter(x => exitCode < 0 && x.final);

    // Handle each listener
    for (const listener of listeners) {
      const { name, handler } = listener;

      try {
        console.debug(`Starting ${name}`);
        const res = handler();
        if (res && res.then) {
          // If a promise, queue for handling
          promises.push(res as Promise<any>);
          res
            .then(() => console.debug(`Completed shut down ${name}`))
            .catch((e: any) => console.error(`Failed shut down of ${name}`, e));
        } else {
          console.debug(`Completed shut down ${name}`);
        }
      } catch (e) {
        console.error(`Failed shut down of ${name}`, e);
      }
    }

    return promises;
  }

  private static async executeAsync(exitCode: number = 0, err?: any) {

    if (this.shutdownCode > 0) { // Killed twice
      if (exitCode > 0) { // Handle force kill
        ogExit(exitCode);
      } else {
        return;
      }
    } else {
      this.shutdownCode = exitCode;
    }

    try {
      // If the err is not an exit code
      if (err && typeof err !== 'number') {
        console.error(err);
      }

      // Get list of all pending listeners
      const promises = await this.getAvailableListeners(exitCode);

      // Run them all, with the ability for the shutdown to preempt
      if (promises.length) {
        const finalRun = Promise.race([
          ...promises,
          new Promise((r, rej) => setTimeout(() => rej(new Error('Timeout on shutdown')), SHUTDOWN_WAIT))
        ]);
        await finalRun;
      }

    } catch (e) {
      console.error(e);
    }

    if (this.shutdownCode >= 0) {
      ogExit(this.shutdownCode);
    }
  }

  /**
   * Begin shutdown process with a given exit code and possible error
   */
  static execute(exitCode: number = 0, err?: any) {
    this.executeAsync(exitCode, err); // Fire and forget
  }

  /**
   * Hook into the process to override the shutdown behavior
   */
  static register() {
    process.exit = this.execute.bind(this) as (() => never); // NOTE: We do not actually throw an error the first time, to allow for graceful shutdown
    process.on('exit', this.execute.bind(this));
    process.on('SIGINT', this.execute.bind(this, 130));
    process.on('SIGTERM', this.execute.bind(this, 143));
    process.on('uncaughtException', (err) => this.unhandled.find(x => !!x(err as Error)));
    process.on('unhandledRejection', (err, p) => this.unhandled.find(x => !!x(err as Error, p)));
    this.unhandled.push(this.execute.bind(this, 1));
  }

  /**
   * Register a shutdown handler
   * @param name  Name to log
   * @param handler Actual code
   * @param final If this should be run an attempt to shutdown or only on the final shutdown
   */
  static onShutdown(name: string, handler: Function, final = false) {
    this.listeners.push({ name, handler, final });
  }

  /**
   * Listen for unhandled exceptions
   */
  static onUnhandled(handler: UnhandledHandler, position = -1) {
    if (position < 0) {
      this.unhandled.push(handler);
    } else {
      this.unhandled.splice(position, 0, handler);
    }
    return this.removeUnhandledHandler.bind(this, handler);
  }

  /**
   * Remove handler for unhandled exceptions
   */
  static removeUnhandledHandler(handler: UnhandledHandler) {
    const index = this.unhandled.indexOf(handler);
    if (index >= 0) {
      this.unhandled.splice(index, 1);
    }
  }

  /**
   * Wait until an unhandled event occurs, or the handler is disconnected
   */
  static waitForUnhandled() {
    const uncaught = Util.resolvablePromise() as Promise<void> & { cancel?: () => void };
    // @ts-ignore
    const h = ShutdownManager.onUnhandled(err => uncaught.reject(err) || true, 0);
    uncaught.cancel = h;
    return uncaught as Promise<void> & { cancel: () => void };
  }
}

export const CatchUnhandled = (): MethodDecorator =>
  (target: any, prop: string | symbol, desc: PropertyDescriptor) => {
    const fn = desc.value;
    desc.value = async function (...args: any[]) {
      const unhandled = ShutdownManager.waitForUnhandled();
      const prom = fn.apply(this, args);
      try {
        return await Promise.race([prom, unhandled]);
      } finally {
        unhandled.cancel();
      }
    };
  };