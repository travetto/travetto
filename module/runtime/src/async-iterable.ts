import { BinaryUtil, type BinaryArray } from './binary.ts';
import { CodecUtil } from './codec.ts';

/**
 * Provides functional stream operators and helpers for async iterables.
 * Accessible via the `.$$` accessor on any async iterable, readable stream, or generator.
 */
export class AsyncIterableOperators<T = unknown> implements AsyncIterable<T> {
  target: () => AsyncIterable<T>;

  /**
   * Returns the underlying async iterator.
   */
  [Symbol.asyncIterator]() {
    return this.target()[Symbol.asyncIterator]();
  }

  /**
   * Creates a new AsyncIterableOperators instance wrapping the target iterable factory.
   */
  constructor(target: () => AsyncIterable<T>) {
    this.target = target;
  }

  /**
   * Transforms each element in the async iterable using the provided transform function.
   * Supports both synchronous and asynchronous transform functions.
   */
  map<U>(transform: (item: T) => U): AsyncIterableOperators<U> {
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
      for await (const item of target()) yield await transform(item);
    });
  }

  /**
   * Filters elements in the async iterable using the provided predicate function.
   * Supports both synchronous and asynchronous predicates.
   */
  filter(predicate: (item: T) => boolean | Promise<boolean>): AsyncIterableOperators<T> {
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
      for await (const item of target()) if (await predicate(item)) yield item;
    });
  }

  /**
   * Iterates through all elements in the async iterable, invoking the visitor function for each element.
   */
  async forEach(visit: (item: T) => Promise<unknown> | unknown): Promise<void> {
    for await (const item of this) await visit(item);
  }

  /**
   * Consumes all elements from the async iterable without processing them, discarding all output.
   */
  async drain(): Promise<void> {
    return this.forEach(() => {}); // No op
  }

  /**
   * Catches errors thrown during iteration, invoking the error callback and continuing stream consumption.
   */
  onError(onError: (error: unknown) => Promise<unknown> | unknown): AsyncIterableOperators<Exclude<T, undefined>> {
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
      for await (const item of target()) {
        try {
          yield item as Exclude<T, undefined>;
        } catch (error) {
          onError(error);
        }
      }
    });
  }

  /**
   * Maps each element to an array or async result and flattens the results into the output stream.
   */
  flatMap<U>(transform: (input: T) => U[] | Promise<U[]>): AsyncIterableOperators<U> {
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
      for await (const item of target()) yield* await transform(item);
    });
  }

  /**
   * Collects all elements of the async iterable into an array.
   */
  async toArray(): Promise<T[]> {
    const out = [];
    for await (const item of this) out.push(item);
    return out;
  }

  /**
   * Splits a chunked binary or text stream into discrete lines, buffering partial chunks across boundaries.
   * @param options Configuration options, such as `skipEmpty` to omit blank lines.
   */
  lines(options?: Parameters<typeof CodecUtil.toLines>[0]): AsyncIterableOperators<string> {
    return this.flatMap(CodecUtil.toLines(options));
  }
  /**
   * Joins a stream into a binary array
   */
  async toBinaryArray(): Promise<BinaryArray> {
    return this.map(CodecUtil.readChunk).toArray().then(BinaryUtil.combineBinaryArrays);
  }
}

// Apply stream operators to the Object prototype, will remove once
// TC39 gets AsyncIterator helpers into the language
try {
  Object.defineProperties(Object.prototype, {
    $$: {
      get() {
        return new AsyncIterableOperators(() => this);
      }
    }
  });
} catch {}
