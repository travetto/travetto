import { EventEmitter } from 'events';
import { Env } from './env';

const px = process.exit;

const MAX_SHUTDOWN_TIME = parseInt(Env.get('MAX_SHUTDOWN_WAIT', '2000'), 10);

export class Shutdown {
  private static listeners: { name: string, handler: Function }[] = [];
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

    const listeners = this.listeners.slice(0);
    this.listeners = [];

    try {
      if (err && typeof err !== 'number') {
        Env.error(err);
      }

      this.listeners = [];

      const promises: Promise<any>[] = [];

      for (const listener of listeners) {
        const { name, handler } = listener;

        try {
          console.debug(`Shutting down ${name}`);
          const res = handler();
          if (res && res.then) {
            promises.push(res as Promise<any>);
            res
              .then(() => console.debug(`Successfully shut down ${name}`))
              .catch((e: any) => Env.error(`Error shutting down ${name}`, e));
          } else {
            console.debug(`Successfully shut down ${name}`);
          }
        } catch (e) {
          Env.error(`Error shutting down ${name}`, e);
        }
      }

      const finalRun = Promise.race([
        ...promises,
        new Promise((r, rej) => setTimeout(rej, MAX_SHUTDOWN_TIME))
      ]);

      await finalRun;

    } catch (e) {
      Env.error('Error on shutting down', e);
    }

    if (this.shutdownCode >= 0) {
      px(this.shutdownCode);
    }
  }

  static register() {
    process.exit = this.execute.bind(this);
    process.on('exit', this.execute.bind(this));
    process.on('SIGINT', this.execute.bind(this, 130));
    process.on('uncaughtException', this.execute.bind(this, 1));
  }

  static onShutdown(name: string, handler: Function) {
    this.listeners.push({ name, handler });
  }

  static execute(exitCode: number = 0, err?: any) {
    this._execute(exitCode, err);
  }

}