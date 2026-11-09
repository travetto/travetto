import { compose, type Duplex, Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

import { BinaryUtil, type BinaryArray } from './binary.ts';
import { CodecUtil } from './codec.ts';
import { castTo } from './types.ts';

/**
 * Provides functional stream operators and helpers for async iterables.
 * Accessible via the `.$$` accessor on any async iterable, readable stream, or generator,
 * or via `AsyncIterator.from(iterable)`.
 */
export class AsyncIterableOperators<T = unknown> implements AsyncIterable<T> {
  target: () => AsyncIterable<T>;

  /**
   * Wrap any iterable or async iterable into an AsyncIterableOperators instance.
   * Matches TC39 AsyncIterator.from.
   */
  static from<T>(source: AsyncIterable<T> | Iterable<T>): AsyncIterableOperators<T> {
    if (source instanceof AsyncIterableOperators) {
      return source;
    } else if (Symbol.asyncIterator in source) {
      return new AsyncIterableOperators(() => source);
    } else if (Symbol.iterator in source) {
      return new AsyncIterableOperators(async function* () {
        yield* source;
      });
    } else {
      throw new TypeError('Argument is not iterable');
    }
  }

  /**
   * Returns this instance for chained property access.
   */
  get $$(): this {
    return this;
  }

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
   * Pipeline support for any inbound duplex stream
   */
  pipe<U = BinaryArray>(stream?: Duplex): AsyncIterableOperators<U> {
    const { target } = this;
    if (stream) {
      return new AsyncIterableOperators(() => compose(target(), stream));
    } else {
      return castTo(this);
    }
  }

  /**
   * Transforms each element in the async iterable using the provided transform function.
   * Supports both synchronous and asynchronous transform functions.
   */
  map<U>(transform: (item: T) => U | Promise<U>): AsyncIterableOperators<U> {
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
      for await (const item of target()) {
        yield await transform(item);
      }
    });
  }

  /**
   * Filters elements in the async iterable using the provided predicate function.
   * Supports both synchronous and asynchronous predicates.
   */
  filter(predicate: (item: T) => boolean | Promise<boolean>): AsyncIterableOperators<T> {
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
      for await (const item of target()) {
        if (await predicate(item)) {
          yield item;
        }
      }
    });
  }

  /**
   * Yields at most the specified number of items from the async iterable.
   */
  take(limit: number): AsyncIterableOperators<T> {
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
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
  drop(limit: number): AsyncIterableOperators<T> {
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
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
  flatMap<U>(transform: (input: T) => AsyncIterable<U> | Iterable<U> | Promise<AsyncIterable<U> | Iterable<U>>): AsyncIterableOperators<U> {
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
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

  /**
   * Splits a chunked binary or text stream into discrete lines, buffering partial chunks across boundaries
   * and flushing any final non-terminated trailing line.
   * @param options Configuration options, such as `skipEmpty` to omit blank lines.
   */
  lines(options?: { skipEmpty?: boolean }): AsyncIterableOperators<string> {
    const skipEmpty = options?.skipEmpty ?? false;
    const { target } = this;
    return new AsyncIterableOperators(async function* () {
      let remainder: BinaryArray = Buffer.alloc(0);
      for await (const chunk of target()) {
        const result = CodecUtil.readLines(remainder, CodecUtil.readChunk(chunk));
        remainder = result.remainder;
        for (const line of result.lines) {
          if (!skipEmpty || line.length > 0) {
            yield line;
          }
        }
      }
      if (remainder.byteLength > 0) {
        const finalLine = CodecUtil.toUTF8String(remainder);
        if (!skipEmpty || finalLine.length > 0) {
          yield finalLine;
        }
      }
    });
  }

  /**
   * Joins a stream into a binary array
   */
  async toBinaryArray(): Promise<BinaryArray> {
    return this.map(CodecUtil.readChunk).toArray().then(BinaryUtil.combineBinaryArrays);
  }
}

/**
 * TC39 AsyncIterator helper interface
 */
export const AsyncIterator = {
  from: AsyncIterableOperators.from
};

// Apply stream operators specifically to stream and async iterator prototypes
// without polluting Object.prototype
try {
  const asyncGeneratorPrototype = Object.getPrototypeOf((async function* () {})());
  const asyncIteratorPrototype = Object.getPrototypeOf(asyncGeneratorPrototype);

  const targets = [Readable.prototype, ReadableStream.prototype, asyncGeneratorPrototype, asyncIteratorPrototype];

  for (const prototype of targets) {
    if (prototype && !('$$' in prototype)) {
      Object.defineProperty(prototype, '$$', {
        get() {
          return new AsyncIterableOperators(() => this);
        },
        configurable: true
      });
    }
  }
} catch {}
