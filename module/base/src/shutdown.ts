import { Env } from './bootstrap/env';

const px = process.exit;

const MAX_SHUTDOWN_TIME = Env.getInt('MAX_SHUTDOWN_WAIT', 2000);

type UnhandledHandler = (err: Error, prom?: Promise<any>) => boolean | undefined | void;
type Listener = { name: string, handler: Function, final?: boolean };

export class Shutdown {
  private static listeners: Listener[] = [];
  private static shutdownCode = -1;
  private static unhandled: UnhandledHandler[] = [];

  private static async getAvailableListeners(exitCode: number) {
    const promises: Promise<any>[] = [];

    // Get valid listeners depending on lifecycle
    const listeners = this.listeners.filter(x => exitCode >= 0 || !x.final);

    // Retain unused listeners for final attempt, if needed
    this.listeners = this.listeners.filter(x => exitCode < 0 && x.final);

    for (const listener of listeners) {
      const { name, handler } = listener;

      try {
        console.debug(`[Shutdown] Starting ${name}`);
        const res = handler();
        if (res && res.then) {
          promises.push(res as Promise<any>);
          res
            .then(() => console.debug(`Completed shut down ${name}`))
            .catch((e: any) => Env.error('[Shutdown]', `Failed shut down of ${name}`, e));
        } else {
          console.debug('[Shutdown]', `Completed shut down ${name}`);
        }
      } catch (e) {
        Env.error('[Shutdown]', `Failed shut down of ${name}`, e);
      }
    }

    return promises;
  }

  private static async executeAsync(exitCode: number = 0, err?: any) {

    if (this.shutdownCode > 0) { // Killed twice
      if (exitCode > 0) { // Handle force kill
        px(exitCode);
      } else {
        return;
      }
    } else {
      this.shutdownCode = exitCode;
    }

    try {
      if (err && typeof err !== 'number') {
        Env.error(err);
      }

      const promises = await this.getAvailableListeners(exitCode);

      if (promises.length) {
        const finalRun = Promise.race([
          ...promises,
          new Promise((r, rej) => setTimeout(() => rej(new Error('Timeout on shutdown')), MAX_SHUTDOWN_TIME))
        ]);
        await finalRun;
      }

    } catch (e) {
      Env.error('[Shutdown]', e);
    }

    if (this.shutdownCode >= 0) {
      px(this.shutdownCode);
    }
  }

  static execute(exitCode: number = 0, err?: any) {
    this.executeAsync(exitCode, err); // Fire and forget
  }

  static register() {
    process.exit = this.execute.bind(this) as (() => never); // NOTE: We do not actually throw an error the first time, to allow for graceful shutdown
    process.on('exit', this.execute.bind(this));
    process.on('SIGINT', this.execute.bind(this, 130));
    process.on('SIGTERM', this.execute.bind(this, 143));
    process.on('uncaughtException', this.execute.bind(this, 1));
    process.on('unhandledRejection', (err, p) => this.unhandled.find(x => !!x(err, p)));
    this.unhandled.push(this.execute.bind(this, 1));
  }

  static onShutdown(name: string, handler: Function, final = false) {
    this.listeners.push({ name, handler, final });
  }

  static onUnhandled(handler: UnhandledHandler, position = -1) {
    if (position < 0) {
      this.unhandled.push(handler);
    } else {
      this.unhandled.splice(position, 0, handler);
    }
  }

  static removeUnhandledHandler(handler: UnhandledHandler) {
    const index = this.unhandled.indexOf(handler);
    if (this.unhandled.includes(handler)) {
      this.unhandled.splice(index, 1);
    }
  }
}