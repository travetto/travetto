import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { arrayBuffer as toBuffer } from 'node:stream/consumers';
import path from 'node:path';

import { TypedObject } from '@travetto/runtime';

const FIELD_TO_HEADER: Record<keyof BlobMeta, string> = {
  contentType: 'content-type',
  contentEncoding: 'content-encoding',
  cacheControl: 'cache-control',
  contentLanguage: 'content-language',
  size: 'content-length',
  hash: '',
  filename: '',
  title: ''
};

export interface BlobMeta {
  /**
   * File size
   */
  size: number;
  /**
   * Mime type of the content
   */
  contentType: string;
  /**
   * Hash of the file contents.  Different files with the same name, will have the same hash
   */
  hash?: string;
  /**
   * The original base filename of the file
   */
  filename?: string;
  /**
   * Filenames title, optional for elements like images, audio, videos
   */
  title?: string;
  /**
   * Content encoding
   */
  contentEncoding?: string;
  /**
   * Content language
   */
  contentLanguage?: string;
  /**
   * Cache control
   */
  cacheControl?: string;
}

export type BlobRange = { start: number, end?: number };


export class BlobWithMeta extends Blob {
  /**
   * Stream meta
   */
  meta: BlobMeta;

  /**
   * Data stream
   */
  #stream: () => Readable;

  constructor(stream: () => Readable, meta: BlobMeta) {
    super([]);
    this.#stream = stream;
    this.meta = meta;
    Object.defineProperty(this, 'size', { value: meta.size });
  }

  stream(): ReadableStream {
    return ReadableStream.from(this.#stream());
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return toBuffer(this.stream());
  }
}

/**
 * A blob response
 */
export class BlobResponse extends BlobWithMeta {

  /**
   * Response byte range, inclusive
   */
  range?: Required<BlobRange>;

  constructor({ meta, stream, range }: {
    stream: () => Readable;
    meta: BlobMeta;
    range?: Required<BlobRange>;
  }) {
    super(stream, meta);
    this.range = range;
  }

  statusCode(): number {
    return this.range ? 206 : 200;
  }

  headers(): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const [f, v] of TypedObject.entries(FIELD_TO_HEADER)) {
      if (this.meta[f] && v) {
        headers[v] = `${this.meta[f]}`;
      }
    }
    if (this.meta.filename) {
      headers['content-disposition'] = `attachment;filename=${path.basename(this.meta.filename)}`;
    }
    if (this.range) {
      headers['accept-ranges'] = 'bytes';
      headers['content-range'] = `bytes ${this.range.start}-${this.range.end}/${this.meta.size}`;
      headers['content-length'] = `${this.range.end - this.range.start + 1}`;
    }
    return headers;
  }
}
