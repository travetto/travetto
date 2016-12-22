export class Shutdown {
  private static listeners: Function[] = [];
  static onShutdown(listener: Function) {
    this.listeners.push(listener);
  }

  static async quit(exit: boolean, err?: any) {
    if (err) {
      console.log(err.stack || err);
    }

    for (let listener of Shutdown.listeners) {
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