import { ExecutionError } from './error';

const og = Promise;

declare global {
  interface Promise<T> {
    status: 'ok' | 'error';
  }
}

/**
 * Promise stub to track creation
 */
function Wrapped(this: Promise<any>, ex: any) {
  const prom = new og(ex);
  this.then = prom.then.bind(prom);
  this.catch = prom.catch.bind(prom);
  this.finally = prom.finally.bind(prom);
  this.then(() => this.status = 'ok',
    () => this.status = 'error');

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
    if (pending.length) {
      let final: Error | undefined;
      await Promise.all(pending).catch(err => final = err);

      // If any return in an error, make that the final result
      throw new ExecutionError(`Pending promises: ${pending.length}`, final?.stack);
    }
  }

  /**
   * Stop the capture
   */
  static stop() {
    // Restore the promise
    global.Promise = og;
    return this.resolvePending(this.pending.filter(x => x.status === undefined));
  }
}