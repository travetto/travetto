import { Env } from './bootstrap/env';

const px = process.exit;

const MAX_SHUTDOWN_TIME = Env.getInt('MAX_SHUTDOWN_WAIT', 2000);

export class Shutdown {
  private static listeners: { name: string, handler: Function, final?: boolean }[] = [];
  private static shutdownCode = -1;

  private static async _execute(exitCode: number = 0, err?: any) {

    if (this.shutdownCode > 0) {
      // Handle force kill
      if (exitCode > 0) {
        px(exitCode);
      } else {
        return;
      }
    }

    this.shutdownCode = exitCode;

    // Get valid listeners depending on lifecycle
    const listeners = this.listeners.filter(x => exitCode >= 0 || !x.final);

    // Retain unused listeners for final attempt, if needed
    this.listeners = this.listeners.filter(x => exitCode < 0 && x.final);

    try {
      if (err && typeof err !== 'number') {
        Env.error(err);
      }

      const promises: Promise<any>[] = [];

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

  static register() {
    process.exit = this.execute.bind(this) as (() => never); // NOTE: We do not actually throw an error the first time, to allow for graceful shutdown
    process.on('exit', this.execute.bind(this));
    process.on('SIGINT', this.execute.bind(this, 130));
    process.on('SIGTERM', this.execute.bind(this, 143));
    process.on('uncaughtException', this.execute.bind(this, 1));
    process.on('unhandledRejection', (err, p) => {
      if (err && (err.message || '').includes('Cannot find module') && Env.watch) { // Handle module reloading
        Env.error(err);
      } else {
        this.execute(1, err);
      }
    });
  }

  static onShutdown(name: string, handler: Function, final = false) {
    this.listeners.push({ name, handler, final });
  }

  static execute(exitCode: number = 0, err?: any) {
    this._execute(exitCode, err);
  }

}