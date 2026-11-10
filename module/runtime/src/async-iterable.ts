import { castTo } from './types.ts';

/**
 * TC39 AsyncIterable helper interface
 *
 * Provides functional stream operators and helpers for async iterables.
 * Wrapped via `AsyncIterator.from(iterable)`.
 */
export class AsyncIterableHelper<T = unknown> implements AsyncIterable<T> {
  target: () => AsyncIterable<T>;

  /**
   * Wrap any iterable or async iterable into an AsyncIterator instance.
   * Matches TC39 AsyncIterator.from.
   */
  static from<T>(source: AsyncIterable<T> | Iterable<T> | (() => AsyncIterable<T>)): AsyncIterableHelper<T> {
    if (source instanceof AsyncIterableHelper) {
      return source;
    } else if (Symbol.asyncIterator in source) {
      return new AsyncIterableHelper(() => source);
    } else if (Symbol.iterator in source) {
      return new AsyncIterableHelper(async function* () {
        yield* source;
      });
    } else {
      throw new TypeError('Argument is not iterable');
    }
  }

  /**
   * Returns the underlying async iterator.
   */
  [Symbol.asyncIterator]() {
    return this.target()[Symbol.asyncIterator]();
  }

  /**
   * Creates a new AsyncIterableHelper instance wrapping the target iterable factory.
   */
  constructor(target: () => AsyncIterable<T>) {
    this.target = target;
  }

  /**
   * Transforms each element in the async iterable using the provided transform function.
   * Supports both synchronous and asynchronous transform functions.
   */
  map<U>(transform: (item: T) => U | Promise<U>): AsyncIterableHelper<U> {
    const { target } = this;
    return new AsyncIterableHelper(async function* () {
      for await (const item of target()) {
        yield await transform(item);
      }
    });
  }

  /**
   * Filters elements in the async iterable using the provided predicate function.
   * Supports both synchronous and asynchronous predicates.
   */
  filter<S extends T = T>(predicate: (item: T) => item is S): AsyncIterableHelper<S>;
  filter(predicate: (item: T) => boolean | Promise<boolean>): AsyncIterableHelper<T>;
  filter(predicate: (item: T) => boolean | Promise<boolean>): AsyncIterableHelper<T> {
    const { target } = this;
    return new AsyncIterableHelper(async function* () {
      for await (const item of target()) {
        if (await predicate(item)) {
          yield castTo(item);
        }
      }
    });
  }

  /**
   * Yields at most the specified number of items from the async iterable.
   */
  take(limit: number): AsyncIterableHelper<T> {
    const { target } = this;
    return new AsyncIterableHelper(async function* () {
      let remaining = limit;
      if (remaining <= 0) {
        return;
      }
      for await (const item of target()) {
        yield item;
        remaining -= 1;
        if (remaining <= 0) {
          break;
        }
      }
    });
  }

  /**
   * Drops the specified number of items from the start of the async iterable.
   */
  drop(limit: number): AsyncIterableHelper<T> {
    const { target } = this;
    return new AsyncIterableHelper(async function* () {
      let remaining = limit;
      for await (const item of target()) {
        if (remaining > 0) {
          remaining -= 1;
        } else {
          yield item;
        }
      }
    });
  }

  /**
   * Iterates through all elements in the async iterable, invoking the visitor function for each element.
   */
  async forEach(visit: (item: T) => Promise<unknown> | unknown): Promise<void> {
    for await (const item of this) {
      await visit(item);
    }
  }

  /**
   * Tests whether at least one element in the async iterable passes the predicate.
   */
  async some(predicate: (item: T) => boolean | Promise<boolean>): Promise<boolean> {
    for await (const item of this) {
      if (await predicate(item)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Tests whether all elements in the async iterable pass the predicate.
   */
  async every(predicate: (item: T) => boolean | Promise<boolean>): Promise<boolean> {
    for await (const item of this) {
      if (!(await predicate(item))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns the first element in the async iterable that satisfies the predicate, or undefined.
   */
  async find(predicate: (item: T) => boolean | Promise<boolean>): Promise<T | undefined> {
    for await (const item of this) {
      if (await predicate(item)) {
        return item;
      }
    }
    return undefined;
  }

  /**
   * Reduces the async iterable to a single value using an accumulator function.
   */
  async reduce<U = T>(reducer: (accumulator: U, item: T) => U | Promise<U>, initialValue?: U): Promise<U> {
    let accumulator = initialValue;
    let first = initialValue === undefined;
    for await (const item of this) {
      if (first) {
        accumulator = castTo(item);
        first = false;
      } else {
        accumulator = await reducer(castTo(accumulator), item);
      }
    }
    if (first) {
      throw new TypeError('Reduce of empty iterable with no initial value');
    }
    return castTo(accumulator);
  }

  /**
   * Maps each element to an array or async result and flattens the results into the output stream.
   */
  flatMap<U>(transform: (input: T) => AsyncIterable<U> | Iterable<U> | Promise<AsyncIterable<U> | Iterable<U>>): AsyncIterableHelper<U> {
    const { target } = this;
    return new AsyncIterableHelper(async function* () {
      for await (const item of target()) {
        yield* await transform(item);
      }
    });
  }

  /**
   * Collects all elements of the async iterable into an array.
   */
  async toArray(): Promise<T[]> {
    const out: T[] = [];
    for await (const item of this) {
      out.push(item);
    }
    return out;
  }
}
