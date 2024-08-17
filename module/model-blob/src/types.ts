import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { arrayBuffer as toBuffer, text as toText } from 'node:stream/consumers';

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

  constructor(stream: () => Readable, meta: ModelBlobMeta, range?: Required<ByteRange>) {
    super([]);
    this.#stream = stream;
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
}