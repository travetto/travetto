export class Shutdown {
  private static listeners: Function[] = [];
  static onShutdown(listener: Function) {
    this.listeners.push(listener);
  }

  static async quit(exitCode: number, err?: any) {

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

    if (exitCode) {
      process.exit(exitCode);
    }
  }
}

process.on('exit', Shutdown.quit.bind(null, 0));
process.on('SIGINT', Shutdown.quit.bind(null, 130));
process.on('uncaughtException', Shutdown.quit.bind(null, 1));