import { InputSource } from './types';

type Itr<T> = Iterator<T> | AsyncIterator<T>;

const hasAsyncItr = (o: any): o is AsyncIterable<any> => Symbol.asyncIterator in o;
const hasItr = (o: any): o is Iterable<any> => Symbol.iterator in o;

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
      if (hasAsyncItr(src)) {
        this.src = src[Symbol.asyncIterator]();
      } else if (hasItr(src)) {
        this.src = src[Symbol.iterator]();
      } else {
        this.src = src();
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