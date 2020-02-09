const og = Promise;

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

export class PromiseCapture {
  static pending: Promise<any>[];
  static checker = (process as any).binding('util').getPromiseDetails;
  static isPending = (prom: Promise<any>) => PromiseCapture.checker(prom)[0] === 0;

  static start() {
    this.pending = [];
    global.Promise = Wrapped;
  }

  static async resolvePending(pending: Promise<any>[]) {
    let final;
    try {
      await Promise.all(pending);
    } catch (err) {
      final = err;
    }

    const ret = new Error(`Pending promises: ${pending.length}`);
    ret.stack = final?.stack ?? ret.stack;
    (ret as any).operator = 'unhandled promise';
    throw ret;
  }

  static stop() {
    global.Promise = og;
    const pending = this.pending.filter(this.isPending);
    delete this.pending;

    if (pending.length) {
      return this.resolvePending(pending);
    }
  }
}