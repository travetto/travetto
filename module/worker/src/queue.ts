import { Util } from '@travetto/runtime';

/**
 * WorkQueue, a manual async iterator.  Items are added manually, and consumed asynchronously
 */
export class WorkQueue<X> implements AsyncIterator<X>, AsyncIterable<X> {

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
    if (signal?.aborted) {
      this.close();
    }
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
      await this.#ready.promise;
      this.#ready = Util.resolvablePromise();
    }
    return { value: (this.#queue.length ? this.#queue.shift() : undefined)!, done: this.#done };
  }

  /**
   * Queue next event to fire
   * @param {boolean} immediate Determines if item(s) should be append or prepended to the queue
   */
  add(item: X, immediate = false): void {
    this.#queue[immediate ? 'unshift' : 'push'](item);
    this.#size += 1;
    this.#ready.resolve();
  }

  /**
   * Queue a list of data to stream
   * @param {boolean} immediate Determines if item(s) should be append or prepended to the queue
   */
  addAll(items: Iterable<X>): void {
    const copy = [...items];
    this.#queue.push(...copy);
    this.#size += copy.length;
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
   * Throw an error from the queue, rejecting and terminating immediately
   */
  async throw(e?: Error): Promise<IteratorResult<X>> {
    this.#done = true;
    this.#ready.reject(e);
    return { value: undefined, done: this.#done };
  }

  /**
   * Get size, will change as items are added
   */
  get size(): number {
    return this.#size;
  }
}