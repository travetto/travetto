import path from 'node:path';
import { statSync } from 'node:fs';
import { Readable, PassThrough } from 'node:stream';
import { isPromise } from 'node:util/types';

import { BinaryUtil, type BinaryType } from './binary.ts';
import { hasFunction } from './types.ts';

const isReadable = hasFunction<Readable>('pipe');

/**
 * Range of bytes, inclusive
 */
export type ByteRange = { start: number, end?: number };

export interface BinaryMetadata {
  /** Size of binary data */
  size?: number;
  /** Mime type of the content */
  contentType?: string;
  /** Hash of binary data contents */
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
  /** Byte range for binary data */
  range?: Required<ByteRange>;
  /** Raw location */
  rawLocation?: string;
}


const BinaryMetaSymbol = Symbol();

export class BinaryBlob extends Blob {

  /** Read metadata for a binary type, if available  */
  static getMetadata(input: BinaryType, metadata: BinaryMetadata = {}): BinaryMetadata {
    const withMeta: BinaryType & { [BinaryMetaSymbol]?: BinaryMetadata } = input;

    metadata = { ...withMeta[BinaryMetaSymbol], ...metadata };

    if (input instanceof BinaryBlob) {
      metadata = { ...input.metadata, ...metadata };
    } else if (BinaryUtil.isBinaryContainer(input)) {
      metadata.size ??= input.size;
    } else if (BinaryUtil.isBinaryArray(input)) {
      metadata.size = input.byteLength;
    } else if (isReadable(input)) {
      metadata.contentEncoding ??= input.readableEncoding!;
      if ('path' in input && typeof input.path === 'string') {
        metadata.filename ??= path.basename(input.path);
        metadata.size ??= statSync(input.path).size;
      }
    }

    return metadata;
  }

  size: number;
  type: string;

  #source: BinaryType | (() => (BinaryType | Promise<BinaryType>));
  #type: BinaryType | undefined;

  metadata: BinaryMetadata = {};

  constructor(source: BinaryType | (() => (BinaryType | Promise<BinaryType>)), metadata: BinaryMetadata = {}) {
    super(); // We just need the inheritance, not the actual Blob constructor behavior
    this.#source = source;
    this.metadata = metadata;
  }

  get source(): BinaryType {
    if (this.#type !== undefined) {
      return this.#type;
    }
    const value = (typeof this.#source === 'function') ? this.#source() : this.#source;
    if (isPromise(value)) {
      const stream = new PassThrough();
      this.#type = stream;
      value.then(
        source => {
          BinaryUtil.pipeline(source, stream).catch(error => stream.destroy(error));
          return stream;
        },
        error => stream.destroy(error)
      );
    } else {
      this.#type = value;
    }
    return this.#type;
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return BinaryUtil.toBuffer(this.source).then(buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  }

  bytes(): Promise<NodeJS.NonSharedUint8Array> {
    return BinaryUtil.toBinaryArray(this.source).then(buffer => new Uint8Array(buffer));
  }

  slice(start?: number, end?: number, _contentType?: string): Blob {
    return new BinaryBlob(async () => {
      const buffer = await BinaryUtil.toBinaryArray(this.source);
      return BinaryUtil.sliceByteArray(buffer, start ?? 0, end);
    }, this.metadata);
  }

  stream(): ReadableStream<NodeJS.NonSharedUint8Array> {
    const readable = BinaryUtil.toReadable(this.source);
    return Readable.toWeb(readable);
  }

  text(): Promise<string> {
    return BinaryUtil.toBuffer(this.source).then(buffer => buffer.toString('utf8'));
  }
}
