import './error';

declare global {
  type Fn<I extends any[] = any[], V = any> = {
    (...args: I): V;
    name: string;
  }

  interface Error {
    /**
     * Provide a representation that is suitable for logging
     * @param sub
     */
    toConsole(sub?: any): any;
  }
  interface Map<K, V> {
    /**
     * Provide a representation that is suitable for output
     */
    toJSON(): any;
  }
  interface Set<T> {
    /**
     * Provide a representation that is suitable for output
     */
    toJSON(): any;
  }
  interface Console {
    /**
     * Log at a fatal level
     * @param msg The message to log
     * @param extra The additional parameters to log
     */
    fatal(msg?: string, ...extra: any[]): void;
  }
}