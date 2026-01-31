import { PassThrough, Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ReadableStream } from 'node:stream/web';
import consumers from 'node:stream/consumers';
import { isArrayBuffer, isPromise, isTypedArray, isUint16Array, isUint32Array, isUint8Array } from 'node:util/types';

import { type Any, castTo, type Class, hasFunction } from './types.ts';

const BINARY_CONSTRUCTORS: Function[] = [castTo(Readable), Buffer, Blob, castTo(ReadableStream), ArrayBuffer, Uint8Array, Uint16Array, Uint32Array];
export type BinaryArray = Uint32Array | Uint16Array | Uint8Array | Buffer<ArrayBuffer> | ArrayBuffer;
export type BinaryStream = Readable | ReadableStream | AsyncIterable<BinaryArray>;
export type BinaryContainer = Blob | File;
export type BinaryType = BinaryArray | BinaryStream | BinaryContainer;

const BINARY_CONSTRUCTOR_SET = new Set<Function>(BINARY_CONSTRUCTORS);

const isReadable = hasFunction<Readable>('pipe');
const isReadableStream = hasFunction<ReadableStream>('pipeTo');
const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
  !!value && (typeof value === 'object' || typeof value === 'function') && Symbol.asyncIterator in value;
const isBinaryConstructor = (value: Function | Class): boolean => BINARY_CONSTRUCTOR_SET.has(value) || BINARY_CONSTRUCTOR_SET.has(Object.getPrototypeOf(value));
const isBinaryArray = (value: unknown): value is BinaryArray =>
  isUint8Array(value) || isArrayBuffer(value) || isUint16Array(value) || isUint32Array(value);
const isBinaryStream = (value: unknown): value is BinaryStream => isReadable(value) || isReadableStream(value) || isAsyncIterable(value);
const isBinaryContainer = (value: unknown): value is BinaryContainer => value instanceof Blob;
const isBinaryType = (value: unknown): value is BinaryType => !!value && (isBinaryArray(value) || isBinaryStream(value) || isBinaryContainer(value));

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
      return BinaryUtil.makeBinaryArray(0);
    }
  }

  /** Convert input to a buffer  */
  static async toBuffer(input: BinaryType): Promise<Buffer<ArrayBuffer>> {
    const bytes = await BinaryUtil.toBinaryArray(input);
    return BinaryUtil.arrayToBuffer(bytes);
  }

  /** Convert input to a readable stream  */
  static toReadable(input: BinaryType): Readable {
    if (isReadable(input)) {
      return input;
    } else if (isBinaryArray(input)) {
      return Readable.from(BinaryUtil.arrayToBuffer(input));
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
      return BinaryUtil.toReadable(input);
    }
  }

  /** Read chunk, default to toString if type is unknown  */
  static readChunk(chunk: Any, encoding?: BufferEncoding | null): BinaryArray {
    return isBinaryArray(chunk) ? BinaryUtil.arrayToBuffer(chunk) :
      typeof chunk === 'string' ? Buffer.from(chunk, encoding ?? 'utf8') :
        Buffer.from(`${chunk}`, 'utf8');
  }

  /** Combine binary arrays  */
  static combineBinaryArrays(arrays: BinaryArray[]): BinaryArray {
    return Buffer.concat(arrays.map(x => BinaryUtil.arrayToBuffer(x)));
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