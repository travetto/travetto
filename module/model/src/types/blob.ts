import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { arrayBuffer as toBuffer, text as toText } from 'node:stream/consumers';
import path from 'node:path';

import { IOUtil } from '@travetto/runtime';

const pair = <T>(obj: T, key: keyof T, h: string, tn: (item: unknown) => string = v => `${v}`): Record<string, string> =>
  (obj[key] ? { [h]: tn(obj[key]) } : {});

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
    return {
      'content-type': this.meta.contentType,
      'content-length': `${this.meta.size}`,
      ...pair(this.meta, 'contentEncoding', 'content-encoding'),
      ...pair(this.meta, 'cacheControl', 'cache-control'),
      ...pair(this.meta, 'contentLanguage', 'content-language'),
      ...pair(this.meta, 'filename', 'content-disposition', v => `attachment;filename=${path.basename(v!.toString())}`),
      ...(this.range ? {
        'accept-ranges': 'bytes',
        'content-range': `bytes ${this.range.start}-${this.range.end}/${this.meta.size}`,
        'content-length': `${this.range.end - this.range.start + 1}`,
      } : {})
    };
  }

  statusCode(): number {
    return this.range ? 206 : 200;
  }

  render(): Readable {
    return this.#stream();
  }
}