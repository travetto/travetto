import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { arrayBuffer as toBuffer, text as toText } from 'node:stream/consumers';
import path from 'node:path';

import { IOUtil, TypedObject } from '@travetto/runtime';

const FIELD_TO_HEADER: Record<keyof ModelBlobMeta, string> = {
  contentType: 'content-type',
  contentEncoding: 'content-encoding',
  cacheControl: 'cache-control',
  contentLanguage: 'content-language',
  size: 'content-length',
  hash: '',
  filename: '',
  title: ''
};

export interface ModelBlobMeta {
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

export type ByteRange = { start: number, end?: number };


export class ModelBlob extends Blob {

  /**
   * Stream meta
   */
  meta: ModelBlobMeta;

  /**
   * Data stream
   */
  #stream: () => Readable;

  /**
   * Response byte range, inclusive
   */
  range?: Required<ByteRange>;

  constructor(stream: () => (Readable | Promise<Readable>), meta: ModelBlobMeta, range?: Required<ByteRange>) {
    super([]);
    this.#stream = IOUtil.getLazyStream(stream);
    this.meta = meta;
    this.range = range;
    Object.defineProperty(this, 'size', { value: meta.size });
  }

  stream(): ReadableStream {
    return ReadableStream.from(this.#stream());
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return toBuffer(this.stream());
  }

  text(): Promise<string> {
    return toText(this.#stream());
  }

  buffer(): Promise<Uint8Array> {
    return toBuffer(this.#stream()).then(v => new Uint8Array(v));
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

  statusCode(): number {
    return this.range ? 206 : 200;
  }

  render(): Readable {
    return this.#stream();
  }
}