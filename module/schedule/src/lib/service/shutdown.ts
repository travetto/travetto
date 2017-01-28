import { EventEmitter } from 'events';

export class Shutdown {
  private static listeners: { name: string, handler: Function }[] = [];
  private static shutdownEvent = new EventEmitter();
  private static shutdownCode = -1;
  private static shutdownPromise = new Promise((resolve) => {
    Shutdown.shutdownEvent.on('shutdown', resolve);
  });

  static onShutdownPromise() {
    return Shutdown.shutdownPromise;
  }

  static onShutdown(name: string, handler: Function) {
    this.listeners.push({ name, handler });
  }

  static async shutdown(exitCode: number, err?: any) {

    if (Shutdown.shutdownCode > 0) {
      return Shutdown.shutdownPromise;
    }

    Shutdown.shutdownCode = exitCode;

    let listeners = Shutdown.listeners.slice(0);
    Shutdown.listeners = [];

    try {
      if (err) {
        console.log(err.stack || err);
      }

      Shutdown.listeners = [];
      if (listeners.length) {
        console.log('');
      }

      for (let listener of listeners) {
        try {
          let {name, handler} = listener;
          console.log(`Shutting down ${name}`);
          let res = handler();
          if (res && res.then) {
            await res;
          }
          console.log(`Successfully shut down ${name}`);
        } catch (e) {
          console.log(`Error shutting down ${name}`);
        }
      }
    } catch (e) {
      console.log('Error on shutting down', e);
    }

    Shutdown.shutdownEvent.emit('shutdown');

    if (Shutdown.shutdownCode >= 0) {
      process.nextTick(() => process.exit(Shutdown.shutdownCode));
    }

    return Shutdown.shutdownPromise;
  }
}

process.on('exit', Shutdown.shutdown.bind(null, 0));
process.on('SIGINT', Shutdown.shutdown.bind(null, 130));
process.on('uncaughtException', Shutdown.shutdown.bind(null, 1));