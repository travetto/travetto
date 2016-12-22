export class Shutdown {
  private static listeners: Function[] = [];
  static onShutdown(listener: Function) {
    this.listeners.push(listener);
  }

  static async quit(exit: boolean, err?: any) {

    let listeners = Shutdown.listeners.slice(0);

    if (err) {
      console.log(err.stack || err);
    }

    if (Shutdown.listeners.length) {
      console.log(`Shutting down, calling ${Shutdown.listeners.length} listeners`);
    }

    Shutdown.listeners = [];

    for (let listener of listeners) {
      try {
        let res = listener();
        if (res && res.then) {
          await res;
        }
      } catch (e) {
        // Do nothing
      }
    }

    if (exit) {
      process.exit();
    }
  }
}

process.on('exit', Shutdown.quit.bind(null, false));
process.on('SIGINT', Shutdown.quit.bind(null, true));
process.on('uncaughtException', Shutdown.quit.bind(null, true));