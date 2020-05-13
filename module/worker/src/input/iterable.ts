import { InputSource } from './types';

type Itr<T> = Iterator<T> | AsyncIterator<T>;

/**
 * Bassic input source given an iterable input
 */
export class IterableInputSource<X> implements InputSource<X> {

  private src: Itr<X>;
  private ondeck: X;
  private done = false;

  constructor(src: Iterable<X> | AsyncIterable<X> | (() => Generator<X>) | (() => AsyncGenerator<X>) | Itr<X>) {
    if ('next' in src) {
      this.src = src;
    } else {
      if (Symbol.asyncIterator in src) {
        this.src = (src as any)[Symbol.asyncIterator]();
      } else if (Symbol.iterator in src) {
        this.src = (src as any)[Symbol.iterator]();
      } else {
        this.src = (src as any)();
      }
    }
  }

  /**
   * Fetch next item from the iterable
   */
  private async primeNext() {
    const res = await this.src.next();
    this.done = !!res.done;
    this.ondeck = res.value;
  }

  /**
   * Determine if the iterable has more data
   */
  async hasNext() {
    if (this.ondeck === undefined) {
      await this.primeNext();
    }
    return !this.done;
  }

  /**
   * Fetch next item
   */
  async next() {
    await this.hasNext();

    const out = this.ondeck;
    delete this.ondeck;
    return out;
  }
}