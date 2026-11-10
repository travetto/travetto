import { castTo } from './types.ts';

/**
 * TC39 AsyncIterable helper interface (subset)
 *
 * Provides functional stream operators and helpers for async iterables.
 */
export class AsyncIterableHelper<T = unknown> implements AsyncIterable<T> {
  target: () => AsyncIterable<T>;

  /** Wrap any async iterable or factory into an empowered stream */
  static from<T>(source: AsyncIterable<T> | (() => AsyncIterable<T>)): AsyncIterableHelper<T> {
    return new AsyncIterableHelper(typeof source === 'function' ? source : () => source);
  }

  [Symbol.asyncIterator]() {
    return this.target()[Symbol.asyncIterator]();
  }

  /** Creates a new AsyncIterableHelper instance wrapping the target iterable factory. */
  constructor(target: () => AsyncIterable<T>) {
    this.target = target instanceof AsyncIterableHelper ? target.target : target;
  }

  /** Transforms each element in the async iterable using the provided transform function. */
  map<U>(transform: (item: T) => U | Promise<U>): AsyncIterableHelper<U> {
    const { target } = this;
    return new AsyncIterableHelper(async function* () {
      for await (const item of target()) yield await transform(item);
    });
  }

  /** Filters elements in the async iterable using the provided predicate function. */
  filter<S extends T = T>(predicate: (item: T) => item is S): AsyncIterableHelper<S>;
  filter(predicate: (item: T) => boolean | Promise<boolean>): AsyncIterableHelper<T>;
  filter(predicate: (item: T) => boolean | Promise<boolean>): AsyncIterableHelper<T> {
    const { target } = this;
    return new AsyncIterableHelper(async function* () {
      for await (const item of target()) {
        if (await predicate(item)) yield castTo(item);
      }
    });
  }

  /** Iterates through all elements in the async iterable, invoking the visitor function for each element. */
  async forEach(visit: (item: T) => Promise<unknown> | unknown): Promise<void> {
    for await (const item of this) await visit(item);
  }

  /** Reduces the async iterable to a single value using an accumulator function. */
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

  /** Maps each element to an array or async result and flattens the results into the output stream. */
  flatMap<U>(transform: (input: T) => AsyncIterable<U> | Iterable<U> | Promise<AsyncIterable<U> | Iterable<U>>): AsyncIterableHelper<U> {
    const { target } = this;
    return new AsyncIterableHelper(async function* () {
      for await (const item of target()) yield* await transform(item);
    });
  }

  /** Collects all elements of the async iterable into an array. */
  async toArray(): Promise<T[]> {
    const out: T[] = [];
    for await (const item of this) out.push(item);
    return out;
  }
}
