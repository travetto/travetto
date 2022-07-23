import { Util } from '@travetto/base';

/**
 * Manual async iterator.  Items are added manually, and consumed asynchronously
 */
export class ManualAsyncIterator<X> implements AsyncIterator<X> {

  #queue: X[] = [];
  #done = false;
  #ready = Util.resolvablePromise();

  /**
   * Initial set of items
   */
  constructor(initial: Iterable<X> = []) {
    this.#queue.push(...initial);
  }

  /**
   * Wait for next event to fire
   */
  async next(): Promise<IteratorResult<X>> {
    if (!this.#done && !this.#queue.length) {
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
    this.#ready.resolve();
  }

  /**
   * Close the iterator
   */
  close(): void {
    this.#done = true;
    this.#ready.resolve();
  }
}