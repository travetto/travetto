import './types';
import type { AsyncIterableOperators } from './async-iterable.ts';

type AsyncIterableProvider<T = unknown> = { $: AsyncIterableOperators<T> };

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
  interface Object extends AsyncIterableProvider<any> {}
  interface AsyncIterable<T = unknown> extends AsyncIterableProvider<T> {} // Remove once async operators land
  interface AsyncGenerator<T = unknown> extends AsyncIterableProvider<T> {} // Remove once async operators land
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
