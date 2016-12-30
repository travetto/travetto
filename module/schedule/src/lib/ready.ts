export class Startup {
  private static promises: Promise<any>[] = [];
  private static listeners: ((...args: any[]) => any)[] = [];
  private static resolved: number = 0;
  private static done: boolean = false;
  private static initialized: boolean = false;
  private static startupPromise = new Promise((resolve) => {
    Startup.onStartup(resolve);
  });

  static waitFor<T>(p: Promise<T>) {
    Startup.promises.push(p);
    p.then(Startup.onPromiseSuccess)
      .catch(Startup.onPromiseFailure);
  }

  static onStartup(cb: (...args: any[]) => any) {
    if (!Startup.done) {
      Startup.listeners.push(cb);
    } else {
      process.nextTick(cb);
    }
  }

  static onStartupPromise() {
    return Startup.startupPromise;
  }

  static onPromiseSuccess() {
    Startup.resolved++;
    process.nextTick(Startup.checkForDone);
  }

  static checkForDone() {
    if (Startup.initialized && Startup.resolved === Startup.promises.length) {
      Startup.done = true;
      Startup.listeners.splice(0, Startup.listeners.length)
        .forEach(p => p());
    }
  }

  static onPromiseFailure(err: any) {
    console.log(err);
    process.exit(0);
  }

  static wait() {
    setTimeout(Startup.checkForDone, 1000);
  }

  static initialize() {
    Startup.initialized = true;
    Startup.wait();
  }
}

export function OnStartup() {
  return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    Startup.onStartup(() => target[propertyKey]());
    return descriptor;
  };
}