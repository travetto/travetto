import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ReadableStream } from 'node:stream/web';
import consumers from 'node:stream/consumers';
import { isArrayBuffer, isTypedArray, isUint16Array, isUint32Array, isUint8Array } from 'node:util/types';
import path from 'node:path';
import { createReadStream, ReadStream } from 'node:fs';

import { type Any, castTo, hasFunction } from './types.ts';

const BINARY_CONSTRUCTORS: Function[] = [castTo(Readable), Buffer, Blob, castTo(ReadableStream), ArrayBuffer, Uint8Array, Uint16Array, Uint32Array];
export type BinaryArray = Uint32Array | Uint16Array | Uint8Array | Buffer<ArrayBuffer> | ArrayBuffer;
export type BinaryStream = Readable | ReadableStream | AsyncIterable<BinaryArray>;
export type BinaryContainer = Blob | File;
export type BinaryType = BinaryArray | BinaryStream | BinaryContainer;

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
  /** Raw location */
  rawLocation?: string;
}

type HashConfig = {
  length?: number;
  hashAlgorithm?: 'sha1' | 'sha256' | 'sha512' | 'md5';
  outputEncoding?: crypto.BinaryToTextEncoding;
};

const BINARY_CONSTRUCTOR_SET = new Set<Function>(BINARY_CONSTRUCTORS);

const isReadable = hasFunction<Readable>('pipe');
const isReadableStream = hasFunction<ReadableStream>('pipeTo');
const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
  !!value && (typeof value === 'object' || typeof value === 'function') && Symbol.asyncIterator in value;
const isBinaryConstructor = (value: Function): boolean => BINARY_CONSTRUCTOR_SET.has(value) || BINARY_CONSTRUCTOR_SET.has(Object.getPrototypeOf(value));
const isBinaryArray = (value: unknown): value is BinaryArray =>
  isUint8Array(value) || isArrayBuffer(value) || isUint16Array(value) || isUint32Array(value);
const isBinaryStream = (value: unknown): value is BinaryStream => isReadable(value) || isReadableStream(value) || isAsyncIterable(value);
const isBinaryContainer = (value: unknown): value is BinaryContainer => value instanceof Blob;
const isBinaryType = (value: unknown): value is BinaryType => !!value && (isBinaryArray(value) || isBinaryStream(value) || isBinaryContainer(value));

const BinaryMetaSymbol = Symbol();

/**
 * Common functions for dealing with binary data/streams
 */
export class BinaryUtil {

  /** Is the provided value a binary constructor  */
  static isBinaryConstructor = isBinaryConstructor;
  /** Is the input a byte array */
  static isBinaryArray = isBinaryArray;
  /** Is the input a byte stream */
  static isBinaryStream = isBinaryStream;
  /** Is the input a binary container */
  static isBinaryContainer = isBinaryContainer;
  /** Is value a binary type  */
  static isBinaryType = isBinaryType;

  /** Set metadata for a binary type  */
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


  /** Convert binary array to an explicit buffer  */
  static arrayToBuffer(input: BinaryArray): Buffer<ArrayBuffer> {
    if (Buffer.isBuffer(input)) {
      return castTo(input);
    } else if (isTypedArray(input)) {
      return Buffer.from(input);
    } else {
      return Buffer.from(input);
    }
  }

  /** Convert input to a binary array  */
  static async toBinaryArray(input: BinaryType | undefined): Promise<BinaryArray> {
    if (isBinaryArray(input)) {
      return input;
    } else if (isBinaryStream(input)) {
      return consumers.buffer(input);
    } else if (isBinaryContainer(input)) {
      return input.arrayBuffer();
    } else {
      return this.makeBinaryArray(0);
    }
  }

  /** Convert input to a buffer  */
  static async toBuffer(input: BinaryType): Promise<Buffer<ArrayBuffer>> {
    const bytes = await this.toBinaryArray(input);
    return this.arrayToBuffer(bytes);
  }

  /** Convert input to a readable stream  */
  static toReadable(input: BinaryType): Readable {
    if (isReadable(input)) {
      return input;
    } else if (isBinaryArray(input)) {
      return Readable.from(this.arrayToBuffer(input));
    } else if (isBinaryContainer(input)) {
      return Readable.fromWeb(input.stream());
    } else if (isReadableStream(input)) {
      return Readable.fromWeb(input);
    } else {
      return Readable.from(input);
    }
  }

  /** Convert input to a binary stream  */
  static toBinaryStream(input: BinaryType): BinaryStream {
    if (isBinaryStream(input)) {
      return input;
    } else {
      return this.toReadable(input);
    }
  }

  /** Read chunk, default to toString if type is unknown  */
  static readChunk(chunk: Any, encoding?: BufferEncoding | null): BinaryArray {
    return isBinaryArray(chunk) ? this.arrayToBuffer(chunk) :
      typeof chunk === 'string' ? Buffer.from(chunk, encoding ?? 'utf8') :
        Buffer.from(`${chunk}`, 'utf8');
  }

  /** Combine binary arrays  */
  static combineBinaryArrays(arrays: BinaryArray[]): BinaryArray {
    return Buffer.concat(arrays.map(x => this.arrayToBuffer(x)));
  }

  /** Agnostic slice of binary array  */
  static sliceByteArray(input: BinaryArray, start: number, end?: number): BinaryArray {
    if (Buffer.isBuffer(input)) {
      return input.subarray(start, end);
    } else if (isArrayBuffer(input)) {
      return input.slice(start, end);
    } else {
      return input.slice(start, end);
    }
  }

  /** Consume input into output  */
  static pipeline(input: BinaryType, output: Writable): Promise<void> {
    return pipeline(this.toBinaryStream(input), output);
  }

  /** Create a binary array of specified size, optionally filled with a value */
  static makeBinaryArray(size: number, fill?: string | number): BinaryArray {
    return Buffer.alloc(size, fill);
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

  /** Compute metadata for a given binary input */
  static async computeMetadata(input: BinaryType, base: BinaryMetadata = {}): Promise<BinaryMetadata> {
    const metadata: BinaryMetadata = { ...base };

    if (BinaryUtil.isBinaryContainer(input)) {
      metadata.size ??= input.size;
      metadata.contentType ??= input.type;
      if (input instanceof File) {
        metadata.filename ??= input.name;
      }
    } else if (BinaryUtil.isBinaryArray(input)) {
      metadata.size ??= input.byteLength;
      metadata.hash ??= await BinaryUtil.hash(input, { hashAlgorithm: 'sha256' });
    } else if (isReadable(input)) {
      metadata.contentEncoding ??= input.readableEncoding!;
      if (input instanceof ReadStream) {
        metadata.rawLocation ??= input.path.toString();
      }
    }

    if (metadata.rawLocation) {
      metadata.filename ??= path.basename(metadata.rawLocation);
      metadata.size ??= (await fs.stat(metadata.rawLocation)).size;
      metadata.hash ??= await BinaryUtil.hash(createReadStream(metadata.rawLocation!), { hashAlgorithm: 'sha256' });
    }

    if (metadata.size) {
      metadata.range ??= { start: 0, end: metadata.size - 1 };
    }

    return metadata;
  }
}