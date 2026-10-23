export class AsyncQueue<X> implements AsyncIterator<X>, AsyncIterable<X> {
  #queue: X[] = [];
  #done = false;
  #ready = Promise.withResolvers<void>();

  constructor(signal?: AbortSignal) {
    signal?.addEventListener('abort', () => this.close());
    if (signal?.aborted) {
      this.close();
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<X> {
    return this;
  }

  async next(): Promise<IteratorResult<X>> {
    while (!this.#done && !this.#queue.length) {
      await this.#ready.promise;
      this.#ready = Promise.withResolvers<void>();
    }
    return { value: (this.#queue.length ? this.#queue.shift() : undefined)!, done: this.#done };
  }

  async throw(error?: Error): Promise<IteratorResult<X>> {
    this.#done = true;
    this.#ready.reject(error);
    return { value: undefined, done: this.#done };
  }

  has(predicate: (item: X) => boolean): boolean {
    return this.#queue.some(predicate);
  }

  drain(): X[] {
    const items = this.#queue.splice(0, this.#queue.length);
    return items;
  }

  add(item: X): void {
    this.#queue.push(item);
    this.#ready.resolve();
  }

  close(): void {
    this.#done = true;
    this.#ready.resolve();
  }
}
