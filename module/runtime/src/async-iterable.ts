/**
 * Custom async iterable providing fluent stream transformations like map, filter, and toArray.
 */
export class CustomAsyncIterable<T> implements AsyncIterable<T> {
  static create<T>(source: (() => AsyncIterable<T>) | AsyncIterable<T>): CustomAsyncIterable<T> {
    return new CustomAsyncIterable(typeof source === 'function' ? source : () => source);
  }

  #source: () => AsyncIterable<T>;

  constructor(source: () => AsyncIterable<T>) {
    this.#source = typeof source === 'function' ? source : () => source;
  }

  /** Async iterator implementation yielding items from the source */
  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this.#source()[Symbol.asyncIterator]();
  }

  /** Transforms and flattens elements using the provided operation */
  flatMap<U>(transform: (item: T) => U[]): CustomAsyncIterable<U> {
    const source = this.#source;
    return new CustomAsyncIterable(async function* () {
      for await (const item of source()) {
        yield* await transform(item);
      }
    });
  }

  /** Transforms elements using the provided operation */
  map<U>(transform: (item: T) => U | Promise<U>): CustomAsyncIterable<U> {
    const source = this.#source;
    return new CustomAsyncIterable(async function* () {
      for await (const item of source()) {
        yield await transform(item);
      }
    });
  }

  /** Filters elements using a predicate function */
  filter(predicate: (item: T) => boolean | Promise<boolean>): CustomAsyncIterable<T> {
    const source = this.#source;
    return new CustomAsyncIterable(async function* () {
      for await (const item of source()) {
        (await predicate(item)) && (yield item);
      }
    });
  }

  /** Collects all items into an array */
  async toArray(): Promise<T[]> {
    const output: T[] = [];
    for await (const item of this) output.push(item);
    return output;
  }

  /** Visits each item in the array */
  async forEach(operation: (item: T) => unknown): Promise<void> {
    for await (const item of this) await operation(item);
  }
}
