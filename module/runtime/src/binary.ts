import { PassThrough, Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ReadableStream } from 'node:stream/web';
import consumers from 'node:stream/consumers';
import { isArrayBuffer, isPromise, isTypedArray, isUint16Array, isUint32Array, isUint8Array, isUint8ClampedArray } from 'node:util/types';

import { type Any, castTo, hasFunction, toConcrete } from './types.ts';

/**
 * Binary Array
 * @concrete
 */
export type BinaryArray = Uint32Array | Uint16Array | Uint8Array | Uint8ClampedArray | Buffer<ArrayBuffer> | ArrayBuffer;
/**
 * Binary Stream
 * @concrete
 */
export type BinaryStream = Readable | ReadableStream | AsyncIterable<BinaryArray>;
/**
 * Binary Container
 * @concrete
 */
export type BinaryContainer = Blob | File;
/**
 * Binary Type
 * @concrete
 */
export type BinaryType = BinaryArray | BinaryStream | BinaryContainer;

const BINARY_CONSTRUCTOR_SET = new Set<unknown>([
  Readable, Buffer, Blob, ReadableStream, ArrayBuffer, Uint8Array,
  Uint16Array, Uint32Array, Uint8ClampedArray
]);

let BINARY_REFS: Set<unknown> | undefined;
const isBinaryTypeReference = (value: unknown): boolean =>
  BINARY_CONSTRUCTOR_SET.has(value) ||
  BINARY_CONSTRUCTOR_SET.has(Object.getPrototypeOf(value)) ||
  (BINARY_REFS ||= new Set<unknown>([
    toConcrete<BinaryType>(),
    toConcrete<BinaryStream>(),
    toConcrete<BinaryArray>(),
    toConcrete<BinaryContainer>(),
  ])).has(value);

const isReadable = hasFunction<Readable>('pipe');
const isReadableStream = hasFunction<ReadableStream>('pipeTo');
const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
  !!value && (typeof value === 'object' || typeof value === 'function') && Symbol.asyncIterator in value;
const isBinaryArray = (value: unknown): value is BinaryArray =>
  isUint8Array(value) || isArrayBuffer(value) || isUint16Array(value) || isUint32Array(value) || isUint8ClampedArray(value);
const isBinaryStream = (value: unknown): value is BinaryStream => isReadable(value) || isReadableStream(value) || isAsyncIterable(value);
const isBinaryContainer = (value: unknown): value is BinaryContainer => value instanceof Blob;
const isBinaryType = (value: unknown): value is BinaryType => !!value && (isBinaryArray(value) || isBinaryStream(value) || isBinaryContainer(value));

/**
 * Common functions for dealing with binary data/streams
 */
export class BinaryUtil {

  /** Is the input a byte array */
  static isBinaryArray = isBinaryArray;
  /** Is the input a byte stream */
  static isBinaryStream = isBinaryStream;
  /** Is the input a binary container */
  static isBinaryContainer = isBinaryContainer;
  /** Is value a binary type  */
  static isBinaryType = isBinaryType;
  /** Is a binary reference */
  static isBinaryTypeReference = isBinaryTypeReference;

  /** Convert binary array to an explicit buffer  */
  static binaryArrayToBuffer(input: BinaryArray): Buffer<ArrayBuffer> {
    if (Buffer.isBuffer(input)) {
      return castTo(input);
    } else if (isTypedArray(input)) {
      return castTo(Buffer.from(input.buffer));
    } else {
      return Buffer.from(input);
    }
  }

  /** Convert binary array to an explicit uint8array  */
  static binaryArrayToUint8Array(input: BinaryArray): Uint8Array {
    if (isUint8Array(input)) {
      return castTo(input);
    } else if (isTypedArray(input)) {
      return castTo(Buffer.from(input.buffer));
    } else {
      return Buffer.from(input);
    }
  }

  /** Convert input to a binary array  */
  static async toBinaryArray(input: BinaryType): Promise<BinaryArray> {
    if (isBinaryArray(input)) {
      return input;
    } else if (isBinaryStream(input)) {
      return consumers.buffer(input);
    } else {
      return input.arrayBuffer();
    }
  }

  /** Convert input to a buffer  */
  static async toBuffer(input: BinaryType): Promise<Buffer<ArrayBuffer>> {
    const bytes = await BinaryUtil.toBinaryArray(input);
    return BinaryUtil.binaryArrayToBuffer(bytes);
  }

  /** Convert input to an ArrayBuffer  */
  static async toArrayBuffer(input: BinaryType): Promise<ArrayBuffer> {
    const data = await BinaryUtil.toBuffer(input);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }

  /** Convert input to a readable stream  */
  static toReadable(input: BinaryType): Readable {
    if (isReadable(input)) {
      return input;
    } else if (isBinaryArray(input)) {
      return Readable.from(BinaryUtil.binaryArrayToBuffer(input));
    } else if (isBinaryContainer(input)) {
      return Readable.fromWeb(input.stream());
    } else if (isReadableStream(input)) {
      return Readable.fromWeb(input);
    } else {
      return Readable.from(input);
    }
  }

  /** Convert input to a binary ReadableStream  */
  static toReadableStream(input: BinaryType): ReadableStream {
    if (isReadableStream(input)) {
      return input;
    } else if (isReadable(input)) {
      return Readable.toWeb(input);
    } else if (isBinaryContainer(input)) {
      return input.stream();
    } else {
      return Readable.toWeb(BinaryUtil.toReadable(input));
    }
  }

  /** Convert input to a binary stream  */
  static toBinaryStream(input: BinaryType): BinaryStream {
    if (isBinaryStream(input)) {
      return input;
    } else {
      return BinaryUtil.toReadableStream(input);
    }
  }

  /** Read chunk, default to toString if type is unknown  */
  static readChunk(chunk: Any, encoding?: BufferEncoding | null): BinaryArray {
    return isBinaryArray(chunk) ? chunk :
      typeof chunk === 'string' ? Buffer.from(chunk, encoding ?? 'utf8') :
        Buffer.from(`${chunk}`, 'utf8');
  }

  /** Combine binary arrays  */
  static combineBinaryArrays(arrays: BinaryArray[]): BinaryArray {
    return Buffer.concat(arrays.map(x => BinaryUtil.binaryArrayToBuffer(x)));
  }

  /** Agnostic slice of binary array  */
  static sliceByteArray(input: BinaryArray, start?: number, end?: number): BinaryArray {
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
    return pipeline(BinaryUtil.toBinaryStream(input), output);
  }

  /** Create a binary array of specified size, optionally filled with a value */
  static makeBinaryArray(size: number, fill?: string | number): BinaryArray {
    return Buffer.alloc(size, fill);
  }

  /**
   * Convert an inbound binary type or factory into a synchronous binary type
   */
  static toSynchronous(input: BinaryType | (() => (BinaryType | Promise<BinaryType>))): BinaryType {
    const value = (typeof input === 'function') ? input() : input;
    if (isPromise(value)) {
      const stream = new PassThrough();
      value.then(result => BinaryUtil.pipeline(result, stream)).catch(error => stream.destroy(error));
      return stream;
    } else {
      return value;
    }
  }
}