import './types.ts';

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
}