/**
 * An asynchronous queue
 */
export class AsyncQueue<X> implements AsyncIterator<X>, AsyncIterable<X> {

  #queue: X[] = [];
  #done = false;
  #ready = Promise.withResolvers<void>();

  /**
   * Initial set of items
   */
  constructor(initial: Iterable<X> = [], signal?: AbortSignal) {
    this.#queue.push(...initial);
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
      this.#ready = Promise.withResolvers<void>();
    }
    return { value: (this.#queue.length ? this.#queue.shift() : undefined)!, done: this.#done };
  }

  /**
   * Queue next event to fire
   * @param {boolean} immediate Determines if item(s) should be append or prepended to the queue
   */
  add(item: X, immediate = false): void {
    this.#queue[immediate ? 'unshift' : 'push'](item);
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
  async throw(error?: Error): Promise<IteratorResult<X>> {
    this.#done = true;
    this.#ready.reject(error);
    return { value: undefined, done: this.#done };
  }
}