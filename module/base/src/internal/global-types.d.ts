import './error';

type Primitive = number | boolean | string | Date | undefined | null | string[] | number[] | Error;
type MessageContext = Record<string, Primitive | Record<string, Primitive>>;

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
    toJSON(sub?: any): any;
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
    log(msg: string, context?: MessageContext): void;
    /** 
     * Cannot properly serialize complex types to structured output (e.g. JSON)
     * @deprecated 
     */
    log(...args: any[]): void;
    info(msg: string, context?: MessageContext): void;
    /** 
     * Cannot properly serialize complex types to structured output (e.g. JSON)
     * @deprecated 
     */
    info(...args: any[]): void;
    debug(msg: string, context?: MessageContext): void;
    /** 
     * Cannot properly serialize complex types to structured output (e.g. JSON)
     * @deprecated 
     */
    debug(...args: any[]): void;
    warn(msg: string, context?: MessageContext | { error?: any }): void;
    /** 
     * Cannot properly serialize complex types to structured output (e.g. JSON)
     * @deprecated 
     */
    warn(...args: any[]): void;
    error(msg: string, context?: MessageContext | { error?: any }): void;
    /** 
     * Cannot properly serialize complex types to structured output (e.g. JSON)
     * @deprecated 
     */
    error(...args: any[]): void;
  }
}