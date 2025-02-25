import './types';

declare global {
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