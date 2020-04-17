import { InputSource } from './types';

export class EventInputSource<X> implements InputSource<X> {
  static resolvablePromise<T = void>() {
    let ops: { resolve: (v: T) => void, reject: (err: Error) => void };
    const prom = new Promise((resolve, reject) => ops = { resolve, reject });
    Object.assign(prom, ops!);
    return prom as Promise<T> & (typeof ops);
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