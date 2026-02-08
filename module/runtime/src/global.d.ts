import './types';

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
  interface Blob { }

  /**
   * @concrete node:buffer#File
   */
  interface File { }

  /**
   * @concrete node:stream/web#ReadableStream
   */
  interface ReadableStream { }

  /**
   * @concrete node:buffer#Buffer
   */
  interface Buffer { }

  namespace NodeJS {
    /**
     * @concrete node:stream#Readable
     */
    interface ReadableStream { }
  }
}

declare module 'buffer' {
  /**
   * @concrete node:buffer#Blob
   */
  interface Blob { }

  /**
   * @concrete node:buffer#File
   */
  interface File { }
}

declare module 'stream' {
  /**
   * @concrete node:stream#Readable
   */
  interface Readable { }
}

declare module 'stream/web' {
  /**
   * @concrete node:stream/web#ReadableStream
   */
  interface ReadableStream { }
}