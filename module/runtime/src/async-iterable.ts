import { castTo, type Any } from './types.ts';

/**
 * Custom async iterable providing fluent stream transformations like map, filter, and toArray.
 */
export class CustomAsyncIterable<T> implements AsyncIterable<T> {
  #source: () => AsyncIterable<Any>;

  constructor(source: AsyncIterable<T> | (() => AsyncIterable<T>)) {
    this.#source = typeof source === 'function' ? source : () => source;
  }

  /**
   * Async iterator implementation yielding items from the source.
   */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    yield* this.#source();
  }

  /**
   * Transforms elements using the provided operation. Returning undefined skips the item.
   */
  map<U>(transform: (item: T) => U | undefined | Promise<U | undefined>): CustomAsyncIterable<U> {
    const existing = this.#source;
    this.#source = async function* () {
      for await (const item of existing()) {
        const result = await transform(item);
        if (result !== undefined) {
          yield result;
        }
      }
    };
    return castTo(this);
  }

  /**
   * Filters elements using a predicate function.
   */
  filter(predicate: (item: T) => boolean | Promise<boolean>): CustomAsyncIterable<T> {
    const existing = this.#source;
    this.#source = async function* () {
      for await (const item of existing()) {
        if (await predicate(item)) {
          yield item;
        }
      }
    };
    return this;
  }

  /**
   * Collects all items into an array.
   */
  async toArray(): Promise<T[]> {
    const output: T[] = [];
    for await (const item of this) {
      output.push(item);
    }
    return output;
  }

  /**
   * Visits each item in the array
   */
  async forEach(operation: (item: T) => unknown): Promise<void> {
    for await (const item of this) {
      await operation(item);
    }
  }
}
