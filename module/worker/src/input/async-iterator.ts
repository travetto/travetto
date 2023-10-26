import { Util } from '@travetto/base';

/**
 * Manual async iterator.  Items are added manually, and consumed asynchronously
 */
export class ManualAsyncIterator<X> implements AsyncIterator<X>, AsyncIterable<X> {

  #queue: X[] = [];
  #done = false;
  #ready = Util.resolvablePromise();
  #size: number;

  /**
   * Initial set of items
   */
  constructor(initial: Iterable<X> = [], signal?: AbortSignal) {
    this.#queue.push(...initial);
    this.#size = this.#queue.length;
    signal?.addEventListener('abort', () => this.close());
  }

  // Allow for iteration
  [Symbol.asyncIterator](): AsyncIterator<X> {
    return this;
  }

  /**
   * Wait for next event to fire
   */
  async next(): Promise<IteratorResult<X>> {
    while (!this.#done && !this.#queue.length) {
      await this.#ready;
      this.#ready = Util.resolvablePromise();
    }
    return { value: (this.#queue.length ? this.#queue.shift() : undefined)!, done: this.#done };
  }

  /**
   * Queue next event to fire
   * @param {boolean} immediate Determines if item(s) should be append or prepended to the queue
   */
  add(item: X | X[], immediate = false): void {
    item = Array.isArray(item) ? item : [item];
    if (!immediate) {
      this.#queue.push(...item);
    } else {
      this.#queue.unshift(...item);
    }
    this.#size += item.length;
    this.#ready.resolve();
  }

  /**
   * Close the iterator
   */
  close(): void {
    this.#done = true;
    this.#ready.resolve();
  }

  /**
   * Get size, will change as items are added
   */
  get size(): number {
    return this.#size;
  }
}