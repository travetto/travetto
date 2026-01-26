import path from 'node:path';
import { ReadStream as FileReadStream, statSync } from 'node:fs';
import { PassThrough, Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ReadableStream } from 'node:stream/web';
import consumers from 'node:stream/consumers';
import { isArrayBuffer, isUint16Array, isUint32Array, isUint8Array } from 'node:util/types';
import { createInterface } from 'node:readline/promises';

import { type Any, type BinaryMetadata, castTo, hasFunction } from './types.ts';

const BlobMetaSymbol = Symbol();

const BINARY_CONSTRUCTORS = [Readable, Buffer, Blob, File, ReadableStream, ArrayBuffer, Uint8Array, Uint16Array, Uint32Array];
export type BinaryArray = Uint32Array | Uint16Array | Uint8Array | Buffer | ArrayBuffer;
export type BinaryStream = Readable | ReadableStream | AsyncIterable<BinaryArray>;
export type BinaryType = BinaryArray | BinaryStream | Blob;

const BINARY_CONSTRUCTOR_SET = new Set(BINARY_CONSTRUCTORS);

const isReadable = hasFunction<Readable>('pipe');
const isReadableStream = hasFunction<ReadableStream>('pipeTo');
const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
  !!value && (typeof value === 'object' || typeof value === 'function') && Symbol.asyncIterator in value;

/**
 * Common functions for dealing with binary data/streams
 */
export class BinaryUtil {

  /** Is the provided value a binary constructor  */
  static isBinaryConstructor(value: Function): boolean {
    return BINARY_CONSTRUCTOR_SET.has(castTo(value));
  }

  /** Is the input a byte array */
  static isBinaryArray(value: unknown): value is BinaryArray {
    return isUint8Array(value) || isArrayBuffer(value) || isUint16Array(value) || isUint32Array(value);
  }

  /** Is the input a byte stream */
  static isBinaryStream(value: unknown): value is BinaryStream {
    return isReadable(value) || isReadableStream(value) || isAsyncIterable(value);
  }

  /** Is value a binary type  */
  static isBinaryType(value: unknown): value is BinaryType {
    return this.isBinaryArray(value) || this.isBinaryStream(value) || value instanceof Blob;
  }

  /** Read metadata for a binary type, if available  */
  static getMetadata(input: BinaryType, metadata: BinaryMetadata = {}): BinaryMetadata {
    if (input instanceof Blob) {
      const withMeta: Blob & { [BlobMetaSymbol]?: BinaryMetadata } = input;
      metadata = { ...withMeta[BlobMetaSymbol], ...metadata };
      metadata.size ??= input.size;
    } else if (this.isBinaryArray(input)) {
      metadata.size = input.byteLength;
    }

    if (input instanceof FileReadStream) {
      metadata.filename ??= path.basename(input.path.toString());
      metadata.size ??= statSync(input.path.toString()).size;
    }

    if (isReadable(input)) {
      if (input.readableEncoding) {
        metadata.contentEncoding ??= input.readableEncoding;
      }
    }

    return metadata;
  }

  /** Make a blob, and assign metadata  */
  static readableBlob(input: () => BinaryType | Promise<BinaryType>, metadata: Omit<BinaryMetadata, 'filename'> & { filename: string }): File;
  static readableBlob(input: () => BinaryType | Promise<BinaryType>, metadata?: BinaryMetadata): Blob;
  static readableBlob(input: () => BinaryType | Promise<BinaryType>, metadata: BinaryMetadata = {}): Blob | File {
    const go = (): Readable => {
      const stream = new PassThrough();
      Promise.resolve(input()).then(
        source => {
          this.pipeline(source, stream).catch(error => stream.destroy(error));
          return stream;
        },
        error => stream.destroy(error)
      );
      return stream;
    };

    const size = metadata.range ? (metadata.range.end - metadata.range.start) + 1 : metadata.size;
    const out: Blob = metadata.filename ?
      new File([], path.basename(metadata.filename), { type: metadata.contentType }) :
      new Blob([], { type: metadata.contentType });

    return Object.defineProperties(out, {
      size: { value: size },
      stream: { value: () => ReadableStream.from(go()) },
      arrayBuffer: { value: () => consumers.arrayBuffer(go()) },
      text: { value: () => consumers.text(go()) },
      bytes: { value: () => consumers.arrayBuffer(go()).then(buffer => new Uint8Array(buffer)) },
      [BlobMetaSymbol]: { value: metadata }
    });
  }

  /** Convert binary array to an explicit buffer  */
  static arrayToBuffer(input: BinaryArray): Buffer {
    if (Buffer.isBuffer(input)) {
      return input;
    } else if (isUint8Array(input) || isUint16Array(input) || isUint32Array(input)) {
      return Buffer.from(input);
    } else {
      return Buffer.from(input);
    }
  }

  /** Convert input to a binary array  */
  static async toBinaryArray(input: BinaryType | undefined): Promise<BinaryArray> {
    if (this.isBinaryArray(input)) {
      return input;
    } else if (this.isBinaryStream(input)) {
      return consumers.buffer(input);
    } else if (input instanceof Blob) {
      return input.arrayBuffer();
    } else {
      return Buffer.alloc(0);
    }
  }

  /** Convert input to a buffer  */
  static async toBuffer(input: BinaryType): Promise<Buffer> {
    const bytes = await this.toBinaryArray(input);
    return this.arrayToBuffer(bytes);
  }

  /** Convert input to a readable stream  */
  static toReadable(input: BinaryType): Readable {
    if (isReadable(input)) {
      return input;
    } else if (this.isBinaryArray(input)) {
      return Readable.from(this.arrayToBuffer(input));
    } else if (input instanceof Blob) {
      return Readable.fromWeb(input.stream());
    } else if (isReadableStream(input)) {
      return Readable.fromWeb(input);
    } else {
      return Readable.from(input);
    }
  }

  /** Convert input to a binary stream  */
  static toBinaryStream(input: BinaryType): BinaryStream {
    if (this.isBinaryStream(input)) {
      return input;
    } else {
      return this.toReadable(input);
    }
  }

  /** Read chunk, default to toString if type is unknown  */
  static readChunk(chunk: Any, encoding?: BufferEncoding | null): BinaryArray {
    return this.isBinaryArray(chunk) ? this.arrayToBuffer(chunk) :
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

  /** Consume lines  */
  static async readLines(stream: BinaryType, handler: (input: string) => unknown | Promise<unknown>): Promise<void> {
    for await (const item of createInterface(this.toReadable(stream))) {
      await handler(item);
    }
  }

  /** Create a binary array of specified size, optionally filled with a value */
  static makeBinaryArray(size: number, fill?: string | number): BinaryArray {
    return Buffer.alloc(size, fill);
  }
}