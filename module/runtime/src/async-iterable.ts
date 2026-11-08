export class AsyncIterableOperators<T = unknown> implements AsyncIterable<T> {
  target: () => AsyncIterable<T>;

  [Symbol.asyncIterator]() {
    return this.target()[Symbol.asyncIterator]();
  }

  constructor(target: () => AsyncIterable<T>) {
    this.target = target;
  }

  map<U>(transform: (item: T) => U): AsyncIterableOperators<U> {
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
      for await (const item of target()) yield await transform(item);
    });
  }

  filter(predicate: (item: T) => boolean | Promise<boolean>): AsyncIterableOperators<T> {
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
      for await (const item of target()) if (await predicate(item)) yield item;
    });
  }

  async forEach(visit: (item: T) => Promise<unknown> | unknown): Promise<void> {
    for await (const item of this) await visit(item);
  }

  onError(onError: (error: unknown) => Promise<unknown> | unknown): AsyncIterableOperators<Exclude<T, undefined>> {
    const { target } = this;
    return new AsyncIterableOperators<Exclude<T, undefined>>(async function* () {
      for await (const item of target()) {
        try {
          yield item;
        } catch (error) {
          onError(error);
        }
      }
    });
  }

  flatMap<U>(transform: (input: T) => U[] | Promise<U[]>): AsyncIterableOperators<U> {
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
      for await (const item of target()) yield* await transform(item);
    });
  }

  async toArray(): Promise<T[]> {
    const out = [];
    for await (const item of this) out.push(item);
    return out;
  }
}

// Apply stream operators to the Object prototype, will remove once
// TC39 gets AsyncIterator helpers into the language
try {
  Object.defineProperties(Object.prototype, {
    $: {
      get() {
        return new AsyncIterableOperators(this);
      }
    }
  });
} catch {}
