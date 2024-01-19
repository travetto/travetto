type PromiseResolver<T> = { resolve: (v: T) => void, reject: (err?: unknown) => void };

function resolvablePromise<T = void>(): Promise<T> & PromiseResolver<T> {
  let ops: PromiseResolver<T>;
  const prom = new Promise<T>((resolve, reject) => ops = { resolve, reject });
  return Object.assign(prom, ops!);
}

export class AsyncQueue<X> implements AsyncIterator<X>, AsyncIterable<X> {
  #queue: X[] = [];
  #done = false;
  #ready = resolvablePromise();

  constructor(signal?: AbortSignal) {
    signal?.addEventListener('abort', () => this.close());
    if (signal?.aborted) {
      this.close();
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<X> { return this; }

  async next(): Promise<IteratorResult<X>> {
    while (!this.#done && !this.#queue.length) {
      await this.#ready;
      this.#ready = resolvablePromise();
    }
    return { value: (this.#queue.length ? this.#queue.shift() : undefined)!, done: this.#done };
  }

  async throw(e?: Error): Promise<IteratorResult<X>> {
    this.#done = true;
    this.#ready.reject(e);
    return { value: undefined, done: this.#done };
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