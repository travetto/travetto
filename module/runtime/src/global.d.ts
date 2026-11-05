import './types';

type PromFunc<T, U> = (item: T) => U | Promise<U>;

interface CombinedIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T> | NodeJS.AsyncIterator<T>;
}

interface AsyncIterableOperations {
  $map<T, U>(this: CombinedIterable<T>, fn: PromFunc<T, U>): CombinedIterable<U>;
  $filter<T>(this: CombinedIterable<T>, fn: PromFunc<T, boolean>): CombinedIterable<T>;
  $toArray<T>(this: CombinedIterable<T>): Promise<T[]>;
  $flatMap<T, U>(this: CombinedIterable<T>, fn: PromFunc<T, U[]>): CombinedIterable<U>;
  $forEach<T>(this: CombinedIterable<T>, fn: PromFunc<T, unknown>): Promise<void>;
}

declare const write: unique symbol;

declare global {
  // https://github.com/microsoft/TypeScript/issues/59012
  interface WritableStreamDefaultWriter<W = any> {
    [write]?: (a: W) => void;
  }

  interface Function {
    /* Exposed for use within framework, only applies to framework managed classes */
    readonly Ⲑid: string;
  }

  /**
   * @concrete node:buffer#Blob
   */
  interface Blob {}

  /**
   * @concrete node:buffer#File
   */
  interface File {}

  /**
   * @concrete node:stream/web#ReadableStream
   */
  interface ReadableStream {}

  /**
   * @concrete node:buffer#Buffer
   */
  interface Buffer {}

  namespace NodeJS {
    /**
     * @concrete node:stream#Readable
     */
    interface ReadableStream {}
  }

  // Applies to everything as its simpler.  The type contract will prevent usage if not
  // an iterable.  Once TC39 gets the async iterators into the language, this will go away
  interface Object extends AsyncIterableOperations {}
}

declare module 'buffer' {
  /**
   * @concrete node:buffer#Blob
   */
  interface Blob {}

  /**
   * @concrete node:buffer#File
   */
  interface File {}
}

declare module 'node:buffer' {
  /**
   * @concrete node:buffer#Blob
   */
  interface Blob {}

  /**
   * @concrete node:buffer#File
   */
  interface File {}
}

declare module 'stream' {
  /**
   * @concrete node:stream#Readable
   */
  interface Readable {}
}

declare module 'stream/web' {
  /**
   * @concrete node:stream/web#ReadableStream
   */
  interface ReadableStream {}
}
