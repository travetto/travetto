import path from 'node:path';
import { createReadStream, ReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { Readable, PassThrough } from 'node:stream';
import { isPromise } from 'node:util/types';

import { BinaryUtil, type BinaryType } from './binary.ts';
import { hasFunction } from './types.ts';
import { CodecUtil } from './codec.ts';

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

  static setMetadata(input: BinaryType, metadata: BinaryMetadata): BinaryMetadata {
    const withMeta: BinaryType & { [BinaryMetaSymbol]?: BinaryMetadata } = input;
    withMeta[BinaryMetaSymbol] = metadata;
    return metadata;
  }

  /** Read metadata for a binary type, if available  */
  static getMetadata(input: BinaryType): BinaryMetadata {
    const withMeta: BinaryType & { [BinaryMetaSymbol]?: BinaryMetadata } = input;
    return withMeta[BinaryMetaSymbol] ?? {};
  }

  static async computeMetadata(input: BinaryType, metadata: BinaryMetadata = {}): Promise<BinaryMetadata> {
    metadata = { ...BinaryBlob.getMetadata(input), ...metadata };

    if (BinaryUtil.isBinaryContainer(input)) {
      metadata.size ??= input.size;
      metadata.contentType ??= input.type;
      if (input instanceof File) {
        metadata.filename ??= input.name;
      }
    } else if (BinaryUtil.isBinaryArray(input)) {
      metadata.size ??= input.byteLength;
      metadata.hash ??= await CodecUtil.hash(input, { hashAlgorithm: 'sha256' });
    } else if (isReadable(input)) {
      metadata.contentEncoding ??= input.readableEncoding!;
      if (input instanceof ReadStream) {
        metadata.rawLocation ??= input.path.toString();
      }
    }

    if (metadata.rawLocation) {
      metadata.filename ??= path.basename(metadata.rawLocation);
      metadata.size ??= (await fs.stat(metadata.rawLocation)).size;
      metadata.hash ??= await CodecUtil.hash(createReadStream(metadata.rawLocation!), { hashAlgorithm: 'sha256' });
    }


    if (metadata.size) {
      metadata.range ??= { start: 0, end: metadata.size - 1 };
    }

    return BinaryBlob.setMetadata(input, metadata);
  }


  #source: BinaryType | (() => (BinaryType | Promise<BinaryType>));

  constructor(source: BinaryType | (() => (BinaryType | Promise<BinaryType>))) {
    super(); // We just need the inheritance, not the actual Blob constructor behavior
    this.#source = source;
  }

  get size(): number {
    const meta = BinaryBlob.getMetadata(this);
    return (meta.range ? (meta.range.end - meta.range.start) + 1 : meta.size) ?? 0;
  }

  get type(): string {
    const meta = BinaryBlob.getMetadata(this);
    return meta.contentType ?? '';
  }

  get source(): BinaryType {
    const value = (typeof this.#source === 'function') ? this.#source() : this.#source;
    if (isPromise(value)) {
      const stream = new PassThrough();
      value.then(source => BinaryUtil.pipeline(source, stream)).catch(error => stream.destroy(error));
      return stream;
    } else {
      return value;
    }
  }

  updateMetadata(metadata: BinaryMetadata): this {
    BinaryBlob.setMetadata(this, {
      ...BinaryBlob.getMetadata(this),
      ...metadata
    });
    return this;
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
    }).updateMetadata({
      range: {
        start: start ?? 0,
        end: (end !== undefined ? end : this.size) - 1
      }
    });
  }

  stream(): ReadableStream<NodeJS.NonSharedUint8Array> {
    const readable = BinaryUtil.toReadable(this.source);
    return Readable.toWeb(readable);
  }

  text(): Promise<string> {
    return BinaryUtil.toBuffer(this.source).then(buffer => buffer.toString('utf8'));
  }
}
