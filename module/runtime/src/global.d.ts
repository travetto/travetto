import './types';

declare const write: unique symbol;
declare global {
  // https://github.com/microsoft/TypeScript/issues/59012
  interface WritableStreamDefaultWriter<W = any> {
    [write]?: (a: W) => void;
  }

  /**
   * @concrete node:buffer#Blob
   */
  interface Blob { }

  /**
   * @concrete node:buffer#File
   */
  interface File { }

  namespace NodeJS {
    /**
     * @concrete node:stream#Readable
     */
    interface ReadableStream { }
  }
}

declare module 'stream' {
  /**
   * @concrete node:stream#Readable
   */
  interface Readable { }
}