import './types';

declare const write: unique symbol;
declare global {
  // https://github.com/microsoft/TypeScript/issues/59012
  interface WritableStreamDefaultWriter<W = any> {
    [write]?: (a: W) => void;
  }
  interface Function {
    Ⲑid: string;
  }
}