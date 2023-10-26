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
  #close = resolvablePromise();

  [Symbol.asyncIterator](): AsyncIterator<X> { return this; }

  async next(): Promise<IteratorResult<X>> {
    while (!this.#done && !this.#queue.length) {
      await this.#ready;
      this.#ready = resolvablePromise();
    }
    return { value: (this.#queue.length ? this.#queue.shift() : undefined)!, done: this.#done };
  }

  add(item: X, immediate = false): void {
    if (!immediate) {
      this.#queue.push(item);
    } else {
      this.#queue.unshift(item);
    }
    this.#ready.resolve();
  }

  onClose(): Promise<void> {
    return this.#close;
  }

  close(): void {
    this.#done = true;
    this.#ready.resolve();
    this.#close.resolve();
  }
}