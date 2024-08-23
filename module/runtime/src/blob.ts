import path from 'node:path';
import { ReadableStream } from 'node:stream/web';
import { text as toText, arrayBuffer as toBuffer } from 'node:stream/consumers';
import { PassThrough, Readable } from 'node:stream';

import { castTo } from './types';

const BLOB_META = Symbol.for('@travetto/runtime:blob-meta');

/**
 * Range of bytes, inclusive
 */
export type ByteRange = { start: number, end?: number };

export interface BlobMeta {
  /** Size of blob */
  size?: number;
  /** Mime type of the content */
  contentType?: string;
  /** Hash of blob contents */
  hash?: string;
  /** The original base filename of the file */
  filename?: string;
  /** Filenames title, optional for elements like images, audio, videos */
  title?: string;
  /** Content encoding */
  contentEncoding?: string;
  /** Content language */
  contentLanguage?: string;
  /** Cache control */
  cacheControl?: string;
  /** Byte range for blob */
  range?: Required<ByteRange>;
}

export class BlobUtil {

  /**
   * Setting blob meta
   */
  static setBlobMeta(blob: Blob, meta: BlobMeta): void {
    castTo<{ [BLOB_META]?: BlobMeta }>(blob)[BLOB_META] = meta;
  }

  /**
   * Getting blob meta
   */
  static getBlobMeta(blob: Blob): BlobMeta | undefined {
    return castTo<{ [BLOB_META]?: BlobMeta }>(blob)[BLOB_META];
  }

  /**
   * Make a blob, and assign metadata
   */
  static readableBlob(input: () => (Readable | Promise<Readable>), metadata: BlobMeta): Blob {
    const stream = new PassThrough();
    const go = (): Readable => {
      Promise.resolve(input()).then(v => v.pipe(stream), (err) => stream.destroy(err));
      return stream;
    };

    const size = metadata.range ? (metadata.range.end - metadata.range.start) + 1 : metadata.size;
    const out: Blob = metadata.filename ?
      new File([], path.basename(metadata.filename), { type: metadata.contentType }) :
      new Blob([], { type: metadata.contentType });

    Object.defineProperties(out, {
      size: { value: size },
      stream: { value: () => ReadableStream.from(go()) },
      arrayBuffer: { value: () => toBuffer(go()) },
      text: { value: () => toText(go()) },
      bytes: { value: () => toBuffer(go()).then(v => new Uint8Array(v)) },
    });

    this.setBlobMeta(out, metadata);

    return out;
  }
}