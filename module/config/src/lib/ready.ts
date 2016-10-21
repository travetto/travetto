export class Ready {
  private static promises: Promise<any>[] = [];
  private static listeners: ((...args: any[]) => any)[] = []
  private static resolved: number = 0;
  private static done: boolean = false;
  private static initialized: boolean = false;

  static waitFor<T>(p: Promise<T>) {
    Ready.promises.push(p);
    p.then(Ready.onPromiseSuccess)
      .catch(Ready.onPromiseFailure)
  }

  static onReady(cb: (...args: any[]) => any) {
    if (!Ready.done) {
      Ready.listeners.push(cb);
    } else {
      process.nextTick(cb);
    }
  }

  static onPromiseSuccess() {
    Ready.resolved++;
    process.nextTick(Ready.checkForDone)
  }

  static checkForDone() {
    if (Ready.initialized && Ready.resolved === Ready.promises.length) {
      Ready.done = true;
      Ready.listeners.splice(0, Ready.listeners.length)
        .forEach(p => p());
    }
  }

  static onPromiseFailure(err: any) {
    console.log(err);
    process.exit(0);
  }

  static wait() {
    setTimeout(Ready.checkForDone, 1000)
  }

  static initialize() {
    Ready.initialized = true;
    Ready.wait();
  }
}

