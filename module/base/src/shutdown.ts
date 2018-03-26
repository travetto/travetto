import { EventEmitter } from 'events';

export class Shutdown {
  private static listeners: { name: string, handler: Function }[] = [];
  private static shutdownCode = -1;
  private static shutdownEmitter = new EventEmitter();
  private static shutdownPromise = new Promise(resolve => {
    Shutdown.shutdownEmitter.on('shutdown', resolve);
  });

  static register() {
    process.on('exit', Shutdown.shutdown.bind(Shutdown, 0));
    process.on('SIGINT', Shutdown.shutdown.bind(Shutdown, 130));
    process.on('uncaughtException', Shutdown.shutdown.bind(Shutdown, 1));
  }

  static onShutdownPromise() {
    return Shutdown.shutdownPromise;
  }

  static onShutdown(name: string, handler: Function) {
    Shutdown.listeners.push({ name, handler });
  }

  static async shutdown(exitCode: number = 0, err?: any) {

    if (this.shutdownCode > 0) {
      return this.shutdownPromise;
    }

    this.shutdownCode = exitCode;

    const listeners = this.listeners.slice(0);
    this.listeners = [];

    try {
      if (err) {
        console.log(err.stack || err);
      }

      this.listeners = [];
      if (listeners.length) {
        console.log('');
      }

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
              .catch((e: any) => console.error(`Error shutting down ${name}`, e));
          } else {
            console.debug(`Successfully shut down ${name}`);
          }
        } catch (e) {
          console.error(`Error shutting down ${name}`, e);
        }
      }

      await Promise.all(promises);
    } catch (e) {
      console.error('Error on shutting down', e);
    }

    this.shutdownEmitter.emit('shutdown');

    if (this.shutdownCode >= 0) {
      process.nextTick(() => process.exit(this.shutdownCode));
    }

    return this.shutdownPromise;
  }
}