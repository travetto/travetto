export class Shutdown {
  private static listeners: { name: string, handler: Function }[] = [];
  static onShutdown(name: string, handler: Function) {
    this.listeners.push({ name, handler });
  }

  static async quit(exitCode: number, err?: any) {

    let listeners = Shutdown.listeners.slice(0);

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

    if (exitCode) {
      process.exit(exitCode);
    }
  }
}

process.on('exit', Shutdown.quit.bind(null, 0));
process.on('SIGINT', Shutdown.quit.bind(null, 130));
process.on('uncaughtException', Shutdown.quit.bind(null, 1));