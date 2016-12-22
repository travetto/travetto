export class Shutdown {
  private static listeners: Function[] = [];
  static onExit(listener: Function) {
    this.listeners.push(listener);
  }

  static quit(exit: boolean, err?: any) {
    if (err) {
      console.log(err.stack || err);
    }

    for (let listener of Shutdown.listeners) {
      try {
        listener();
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