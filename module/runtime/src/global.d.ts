import { BlobMeta } from './types';

// https://github.com/microsoft/TypeScript/issues/59012
declare const write: unique symbol;
declare global {
  interface WritableStreamDefaultWriter<W = any> {
    [write]?: (a: W) => void;
  }
  interface Function {
    Ⲑid: string;
  }

  interface Blob {
    readonly meta?: Readonly<BlobMeta>;
  }

  interface File {
    readonly meta?: Readonly<BlobMeta>;
  }
}