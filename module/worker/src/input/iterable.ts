import { WorkSet } from './types';

type Itr<T> = Iterator<T> | AsyncIterator<T>;

const hasAsyncItr = (o: unknown): o is AsyncIterable<unknown> => !!o && typeof o === 'object' && Symbol.asyncIterator in o;
const hasItr = (o: unknown): o is Iterable<unknown> => !!o && typeof o === 'object' && Symbol.iterator in o;

/**
 * Basic input source given an iterable input
 */
export class IterableWorkSet<X> implements WorkSet<X> {

  #src: Itr<X>;
  #ondeck?: X;
  #done = false;
  #size?: number;

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
    if (Array.isArray(src)) {
      this.#size = src.length;
    } else if (src instanceof Set) {
      this.#size = src.size;
    }
  }

  /**
   * Fetch next item from the iterable
   */
  async #primeNext(): Promise<void> {
    const res = await this.#src.next();
    this.#done = !!res.done;
    this.#ondeck = res.value;
  }

  /**
   * Determine if the iterable has more data
   */
  async hasNext(): Promise<boolean> {
    if (this.#ondeck === undefined) {
      await this.#primeNext();
    }
    return !this.#done;
  }

  /**
   * Fetch next item
   */
  async next(): Promise<X> {
    await this.hasNext();

    const out = this.#ondeck!;
    this.#ondeck = undefined;
    return out;
  }

  /**
   * Get size, if defined
   */
  get size(): number | undefined {
    return this.#size;
  }
}