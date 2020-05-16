const og = Promise;

/**
 * Promise stub to track creation
 */
function Wrapped(this: Promise<any>, ex: any) {
  const prom = new og(ex);
  this.then = prom.then.bind(prom);
  this.catch = prom.catch.bind(prom);
  this.finally = prom.finally.bind(prom);

  if (PromiseCapture.pending) {
    PromiseCapture.pending.push(prom);
  }
}

Wrapped.race = Promise.race.bind(Promise);
Wrapped.all = Promise.all.bind(Promise);
Wrapped.resolve = Promise.resolve.bind(Promise);
Wrapped.reject = Promise.reject.bind(Promise);

/**
 * Promise watcher, to catch any unfinished promises
 */
export class PromiseCapture {
  static pending: Promise<any>[];
  // @ts-ignore // This relies upon internals of node until Promise.allSettled becomes available
  static checker = process.binding('util').getPromiseDetails;
  /**
   * Determine if a promise is done or not
   */
  static isPending = (prom: Promise<any>) => PromiseCapture.checker(prom)[0] === 0;

  /**
   * Swap method and track progress
   */
  static start() {
    this.pending = [];
    global.Promise = Wrapped;
  }

  /**
   * Wait for all promises to resolve
   */
  static async resolvePending(pending: Promise<any>[]) {
    let final;
    try {
      await Promise.all(pending);
    } catch (err) {
      final = err;
    }
    // If any return in an error, make that the final result
    const ret = new Error(`Pending promises: ${pending.length}`);
    ret.stack = final?.stack ?? ret.stack;
    throw ret;
  }

  /**
   * Stop the capture
   */
  static stop() {
    // Restore the promise
    global.Promise = og;
    // Find all incomplete
    const pending = this.pending.filter(this.isPending);
    delete this.pending;

    if (pending.length) {
      return this.resolvePending(pending);
    }
  }
}