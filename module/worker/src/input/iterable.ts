import { WorkSet } from './types';

type Itr<T> = Iterator<T> | AsyncIterator<T>;

const hasAsyncItr = (o: unknown): o is AsyncIterable<unknown> => !!o && Symbol.asyncIterator in (o as object);
const hasItr = (o: unknown): o is Iterable<unknown> => !!o && Symbol.iterator in (o as object);

/**
 * Basic input source given an iterable input
 */
export class IterableWorkSet<X> implements WorkSet<X> {

  #src: Itr<X>;
  #ondeck?: X;
  #done = false;

  constructor(src: Iterable<X> | AsyncIterable<X> | (() => Generator<X>) | (() => AsyncGenerator<X>) | Itr<X>) {
    if ('next' in src) {
      this.#src = src;
    } else {
      if (hasAsyncItr(src)) {
        this.#src = src[Symbol.asyncIterator]();
      } else if (hasItr(src)) {
        this.#src = src[Symbol.iterator]();
      } else {
        this.#src = src();
      }
    }
  }

  /**
   * Fetch next item from the iterable
   */
  async #primeNext() {
    const res = await this.#src.next();
    this.#done = !!res.done;
    this.#ondeck = res.value;
  }

  /**
   * Determine if the iterable has more data
   */
  async hasNext() {
    if (this.#ondeck === undefined) {
      await this.#primeNext();
    }
    return !this.#done;
  }

  /**
   * Fetch next item
   */
  async next() {
    await this.hasNext();

    const out = this.#ondeck!;
    this.#ondeck = undefined;
    return out;
  }
}