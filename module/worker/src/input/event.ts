import { InputSource } from './types';

export class EventInputSource<X> implements InputSource<X> {
  static resolvablePromise<T = void>(): Promise<T> & { resolve: (v: T) => void, reject: (err: Error) => void } {
    let ops;
    const prom = new Promise((resolve, reject) => ops = { resolve, reject });
    Object.assign((prom as any), ops);
    return prom as any;
  }

  queue: X[] = [];
  ready = EventInputSource.resolvablePromise();

  constructor(initial: Iterable<X> = []) {
    this.queue.push(...initial);
  }

  hasNext() {
    return true;
  }

  async next() {
    if (!this.queue.length) {
      await this.ready;
      this.ready = EventInputSource.resolvablePromise();
    }
    return this.queue.shift()!;
  }

  trigger(item: X | X[], immediate = false) {
    item = Array.isArray(item) ? item : [item];
    if (!immediate) {
      this.queue.push(...item);
    } else {
      this.queue.unshift(...item);
    }
    this.ready.resolve();
  }
}