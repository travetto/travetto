import 'node:fs';

// Remove once node 26 types are released
declare module 'node:fs' {
  interface StatOptions {
    throwIfNoEntry?: boolean;
  }
}

declare const write: unique symbol;
declare global {
  // https://github.com/microsoft/TypeScript/issues/59012
  interface WritableStreamDefaultWriter<W = any> {
    [write]?: (a: W) => void;
  }
}