const og = Promise;

import { AssertionError } from 'assert';

// TODO: Document
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

// TODO: Document
export class PromiseCapture {
  static pending: Promise<any>[];
  // @ts-ignore
  static checker = process.binding('util').getPromiseDetails;
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

    const ret = new AssertionError({ message: `Pending promises: ${pending.length}` });
    ret.stack = final?.stack ?? ret.stack;
    ret.operator = 'unhandled promise';
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