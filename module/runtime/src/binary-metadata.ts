import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream, ReadStream } from 'node:fs';

import { BinaryUtil, type BinaryArray, type BinaryContainer, type BinaryStream, type BinaryType } from './binary.ts';
import { RuntimeError } from './error.ts';
import { CodecUtil } from './codec.ts';

type BlobInput = BinaryType | (() => (BinaryType | Promise<BinaryType>));

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
      input = CodecUtil.fromUTF8String(input);
    }

    if (BinaryUtil.isBinaryArray(input)) {
      hash.update(BinaryUtil.binaryArrayToBuffer(input));
      return hash.digest(outputEncoding).substring(0, length);
    } else {
      return BinaryUtil.pipeline(input, hash).then(() =>
        hash.digest(outputEncoding).substring(0, length)
      );
    }
  }

  /** Compute the length of the binary data to be returned */
  static readLength(metadata: BinaryMetadata): number | undefined {
    return metadata.range ? (metadata.range.end - metadata.range.start + 1) : metadata.size;
  }

  /** Compute metadata for a given binary input */
  static async compute(input: BlobInput, base: BinaryMetadata = {}): Promise<BinaryMetadata> {
    if (typeof input === 'function') {
      input = await input();
    }
    const metadata = { ...BinaryMetadataUtil.read(input), ...base };

    if (BinaryUtil.isBinaryContainer(input)) {
      metadata.size ??= input.size;
      metadata.contentType ??= input.type;
      if (input instanceof File) {
        metadata.filename ??= input.name;
      }
    } else if (BinaryUtil.isBinaryArray(input)) {
      metadata.size ??= input.byteLength;
      metadata.hash ??= this.hash(input, { hashAlgorithm: 'sha256' });
    } else if (input instanceof ReadStream) {
      const location = input.path.toString();
      metadata.filename ??= path.basename(location);
      metadata.contentEncoding ??= input.readableEncoding!;
      metadata.size ??= (await fs.stat(location)).size;
      metadata.hash ??= await this.hash(createReadStream(location), { hashAlgorithm: 'sha256' });
    } else if (input && typeof input === 'object' && 'readableEncoding' in input && typeof input.readableEncoding === 'string') {
      metadata.contentEncoding ??= input.readableEncoding!;
    }

    return metadata;
  }

  /**
   * Rewrite a blob to support metadata, and provide a dynamic input source
   */
  static defineBlob<T extends Blob>(target: T, input: BlobInput, metadata: BinaryMetadata = {}): typeof target {
    const inputFn = async (): Promise<BinaryType> => typeof input === 'function' ? await input() : input;
    this.write(target, metadata);

    Object.defineProperties(target, {
      size: { get() { return BinaryMetadataUtil.readLength(metadata); } },
      type: { get() { return metadata.contentType; } },
      name: { get() { return metadata.filename; } },
      arrayBuffer: { value: () => inputFn().then(BinaryUtil.toArrayBuffer) },
      stream: { value: () => BinaryUtil.toReadableStream(BinaryUtil.toSynchronous(input)) },
      bytes: { value: () => inputFn().then(BinaryUtil.toBuffer) },
      text: { value: () => inputFn().then(BinaryUtil.toBinaryArray).then(CodecUtil.toUTF8String) },
      slice: {
        value: (start?: number, end?: number, _contentType?: string) => {
          const result = target instanceof File ? new File([], '') : new Blob([]);
          return BinaryMetadataUtil.defineBlob(result,
            () => inputFn().then(BinaryUtil.toBinaryArray).then(data => BinaryUtil.sliceByteArray(data, start, end)),
            {
              ...metadata,
              range: { start: start ?? 0, end: end ?? metadata.size! - 1 },
            }
          );
        }
      }
    });
    return target;
  }

  /**
   * Make a blob that contains the appropriate metadata
   */
  static makeBlob(source: BlobInput, metadata?: BinaryMetadata): Blob {
    return this.defineBlob(new Blob([]), source, metadata);
  }

  /**
   * Enforce byte range for stream stream/file of a certain size
   */
  static enforceRange(range: ByteRange, metadata?: BinaryMetadata): Required<ByteRange> {
    if (!metadata || metadata.size === undefined) {
      throw new RuntimeError('Cannot enforce range on data with unknown size', { category: 'data' });
    }
    const size = metadata.size;

    // End is inclusive
    const [start, end] = [range.start, Math.min(range.end ?? (size - 1), size - 1)];

    if (Number.isNaN(start) || Number.isNaN(end) || !Number.isFinite(start) || start >= size || start < 0 || start > end) {
      throw new RuntimeError('Invalid position, out of range', { category: 'data', details: { start, end, size } });
    }

    return { start, end };
  }
}