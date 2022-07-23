import type { Class } from '@travetto/base';
import type { DeepPartial } from './types';

declare global {
  interface Function {
    /**
     * Will produce a new instance of this class with the provided data bound to it
     * @param data The data to bind
     * @param view The optional view to limit the bind to
     */
    from<T>(this: Class<T>, data: DeepPartial<T>, view?: string): T;
  }

  namespace NodeJS {
    /**
     * @concrete stream:Readable:node
     */
    interface ReadableStream { }
  }
}

declare module 'stream' {
  /**
   * @concrete stream:Readable:node
   */
  interface Readable { }
}
