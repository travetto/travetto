import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream, ReadStream } from 'node:fs';
import { PassThrough, Readable } from 'node:stream';
import { isPromise } from 'node:util/types';

import { BinaryUtil, type BinaryArray, type BinaryContainer, type BinaryStream, type BinaryType } from './binary.ts';
import { hasFunction } from './types.ts';
import { AppError } from './error.ts';

const isReadable = hasFunction<Readable>('pipe');

type BlobBinaryInput = BinaryType | (() => (BinaryType | Promise<BinaryType>));

/** Range of bytes, inclusive */
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
}

type HashConfig = {
  length?: number;
  hashAlgorithm?: 'sha1' | 'sha256' | 'sha512' | 'md5';
  outputEncoding?: crypto.BinaryToTextEncoding;
};

const BinaryMetaSymbol = Symbol();

export class BinaryMetadataUtil {
  /**
   * Establishes the blob/file properties and metadata
   */
  static #finishBlob<T extends Blob>(blob: T, source: BlobBinaryInput, metadata?: BinaryMetadata): T {
    const getSource = (): BinaryType => {
      const value = (typeof source === 'function') ? source() : source;
      if (isPromise(value)) {
        const stream = new PassThrough();
        value.then(result => BinaryUtil.pipeline(result, stream)).catch(error => stream.destroy(error));
        return stream;
      } else {
        return value;
      }
    };

    BinaryMetadataUtil.write(blob, metadata ?? {});

    Object.defineProperties(blob, {
      size: { get: () => BinaryMetadataUtil.readDataSize(blob) },
      type: { get: () => BinaryMetadataUtil.read(blob).contentType },
      filename: { get: () => BinaryMetadataUtil.read(blob).filename },
      arrayBuffer: { value: () => BinaryUtil.toBuffer(getSource()).then(data => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)) },
      bytes: { value: () => BinaryUtil.toBinaryArray(getSource()).then(data => new Uint8Array(data)) },
      stream: { value: () => Readable.toWeb(BinaryUtil.toReadable(getSource())) },
      text: { value: () => BinaryUtil.toBuffer(getSource()).then(buffer => buffer.toString('utf8')) },
    });
    return blob;
  }

  /** Set metadata for a binary type  */
  static write(input: BinaryType, metadata: BinaryMetadata): BinaryMetadata {
    const withMeta: BinaryType & { [BinaryMetaSymbol]?: BinaryMetadata } = input;
    return withMeta[BinaryMetaSymbol] = metadata;
  }

  /** Read metadata for a binary type, if available  */
  static read(input: BinaryType): BinaryMetadata {
    const withMeta: BinaryType & { [BinaryMetaSymbol]?: BinaryMetadata } = input;
    return withMeta[BinaryMetaSymbol] ?? {};
  }

  /** Generate a hash from an input value  * @param input The seed value to build the hash from
   * @param length The optional length of the hash to generate
   * @param hashAlgorithm The hash algorithm to use
   * @param outputEncoding The output encoding format
   */
  static hash(input: string | BinaryArray, config?: HashConfig): string;
  static hash(input: BinaryStream | BinaryContainer, config?: HashConfig): Promise<string>;
  static hash(input: string | BinaryType, config?: HashConfig): string | Promise<string> {
    const hashAlgorithm = config?.hashAlgorithm ?? 'sha512';
    const outputEncoding = config?.outputEncoding ?? 'hex';
    const length = config?.length;
    const hash = crypto.createHash(hashAlgorithm).setEncoding(outputEncoding);

    if (typeof input === 'string') {
      input = Buffer.from(input, 'utf8');
    }

    if (BinaryUtil.isBinaryArray(input)) {
      hash.update(BinaryUtil.arrayToBuffer(input));
      return hash.digest(outputEncoding).substring(0, length);
    } else {
      return BinaryUtil.pipeline(input, hash).then(() =>
        hash.digest(outputEncoding).substring(0, length)
      );
    }
  }

  static readDataSize(input: BinaryType): number | undefined {
    const metadata = this.read(input);
    return metadata.range ? (metadata.range.end - metadata.range.start + 1) : metadata.size;
  }

  /** Compute metadata for a given binary input */
  static async compute(input: BinaryType, base: BinaryMetadata = {}, rawLocation?: string): Promise<BinaryMetadata> {
    const metadata: BinaryMetadata = {
      ...BinaryMetadataUtil.read(input),
      ...base
    };

    if (BinaryUtil.isBinaryContainer(input)) {
      metadata.size ??= input.size;
      metadata.contentType ??= input.type;
      if (input instanceof File) {
        metadata.filename ??= input.name;
      }
    } else if (BinaryUtil.isBinaryArray(input)) {
      metadata.size ??= input.byteLength;
      metadata.hash ??= await this.hash(input, { hashAlgorithm: 'sha256' });
    } else if (isReadable(input)) {
      metadata.contentEncoding ??= input.readableEncoding!;
      if (input instanceof ReadStream) {
        rawLocation ??= input.path.toString();
      }
    }

    if (rawLocation) {
      metadata.filename ??= path.basename(rawLocation);
      metadata.size ??= (await fs.stat(rawLocation)).size;
      metadata.hash ??= await this.hash(createReadStream(rawLocation!), { hashAlgorithm: 'sha256' });
    }

    return metadata;
  }

  /**
   * Make a blob that contains the appropriate metadata
   */
  static makeBlob(source: BlobBinaryInput, metadata?: BinaryMetadata): Blob {
    return BinaryMetadataUtil.#finishBlob(new Blob(), source, metadata);
  }

  /**
   * Make a file that contains the appropriate metadata
   */
  static makeFile(source: BlobBinaryInput, metadata: BinaryMetadata): File {
    return BinaryMetadataUtil.#finishBlob(new File([], ''), source, metadata);
  }

  /**
   * Enforce byte range for stream stream/file of a certain size
   */
  static enforceRange(range: ByteRange, metadata?: BinaryMetadata): Required<ByteRange> {
    if (!metadata || metadata.size === undefined) {
      throw new AppError('Cannot enforce range on data with unknown size', { category: 'data' });
    }
    const size = metadata.size;

    // End is inclusive
    const [start, end] = [range.start, Math.min(range.end ?? (size - 1), size - 1)];

    if (Number.isNaN(start) || Number.isNaN(end) || !Number.isFinite(start) || start >= size || start < 0 || start > end) {
      throw new AppError('Invalid position, out of range', { category: 'data', details: { start, end, size } });
    }

    return { start, end };
  }
}