import 'node:os';

import { BlobMeta } from './blob';

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
    meta?: BlobMeta;
  }
  interface File {
    meta?: BlobMeta;
  }
}