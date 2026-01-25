import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { ReadStream as FileReadStream, statSync } from 'node:fs';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ReadableStream } from 'node:stream/web';
import consumers from 'node:stream/consumers';
import { isArrayBuffer, isUint8Array } from 'node:util/types';

import { type Any, type BinaryMetadata, type ByteRange, castTo, hasFunction } from './types.ts';
import { Util } from './util.ts';
import { AppError } from './error.ts';

const BlobMetaSymbol = Symbol();

const BINARY_CONSTRUCTORS = [Readable, Buffer, Blob, File, ReadableStream, ArrayBuffer, Uint8Array];
export type ByteArray = Uint8Array | Buffer | ArrayBuffer;
export type ByteStream = Readable | ReadableStream | AsyncIterable<ByteArray | string>;
export type BinaryType = ByteArray | ByteStream | Blob;

const BINARY_CONSTRUCTOR_SET = new Set(BINARY_CONSTRUCTORS);

/**
 * Common functions for dealing with binary data/streams
 */
export class BinaryUtil {
  /** Is Array Buffer */
  static isArrayBuffer = isArrayBuffer;
  /** Is Uint8Array */
  static isUint8Array = isUint8Array;
  /** Is Readable */
  static isReadable = hasFunction<Readable>('pipe');
  /** Is ReadableStream */
  static isReadableStream = hasFunction<ReadableStream>('pipeTo');
  /** Is Async Iterable */
  static isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
    !!value && (typeof value === 'object' || typeof value === 'function') && Symbol.asyncIterator in value;

  static isBinaryConstructor(value: Function): boolean {
    return BINARY_CONSTRUCTOR_SET.has(castTo(value));
  }

  /** Is the input a byte array */
  static isByteArray(value: unknown): value is ByteArray {
    return this.isUint8Array(value) || this.isArrayBuffer(value);
  }

  /** Is the input a byte stream */
  static isByteStream(value: unknown): value is ByteStream {
    return this.isReadable(value) || this.isReadableStream(value) || this.isAsyncIterable(value);
  }

  /**
   * Is value a binary type
   */
  static isBinaryType(value: unknown): value is BinaryType {
    return this.isByteArray(value) || this.isByteStream(value) || value instanceof Blob;
  }

  /**
   * Generate a proper sha512 hash from an input value
   * @param input The seed value to build the hash from
   * @param length The optional length of the hash to generate
   */
  static hash(input: string, length: number = -1): string {
    const hash = crypto.createHash('sha512');
    hash.update(input);
    const digest = hash.digest('hex');
    return length > 0 ? digest.substring(0, length) : digest;
  }

  /**
   * Compute hash from an input blob, buffer or readable stream.
   */
  static async hashInput(input: BinaryType): Promise<string> {
    const hash = crypto.createHash('sha256').setEncoding('hex');
    if (Buffer.isBuffer(input)) {
      hash.write(input);
    } else if (this.isArrayBuffer(input)) {
      hash.write(Buffer.from(input));
    } else if (input instanceof Blob) {
      await pipeline(Readable.fromWeb(input.stream()), hash);
    } else {
      await pipeline(input, hash);
    }
    return hash.digest('hex').toString();
  }

  /**
   * Write file and copy over when ready
   */
  static async bufferedFileWrite(file: string, content: string, checkHash = false): Promise<void> {
    if (checkHash) {
      const current = await fs.readFile(file, 'utf8').catch(() => '');
      if (this.hash(current) === this.hash(content)) {
        return;
      }
    }

    const temp = path.resolve(os.tmpdir(), `${process.hrtime()[1]}.${path.basename(file)}`);
    await fs.writeFile(temp, content, 'utf8');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.copyFile(temp, file);
    await fs.rm(temp, { force: true });
  }

  /**
   * Make a blob, and assign metadata
   */
  static readableBlob(input: () => BinaryType | Promise<BinaryType>, metadata: Omit<BinaryMetadata, 'filename'> & { filename: string }): File;
  static readableBlob(input: () => BinaryType | Promise<BinaryType>, metadata?: BinaryMetadata): Blob;
  static readableBlob(input: () => BinaryType | Promise<BinaryType>, metadata: BinaryMetadata = {}): Blob | File {
    const go = (): Readable => {
      const stream = new PassThrough();
      Promise.resolve(input()).then(
        source => {
          const readable = this.toReadable(source);
          return readable.pipe(stream);
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

  /**
   * Get a hashed location/path for a blob
   */
  static hashedBlobLocation(meta: BinaryMetadata): string {
    const hash = meta.hash ?? Util.uuid();

    let parts = hash.match(/(.{1,4})/g)!.slice();
    if (parts.length > 4) {
      parts = [...parts.slice(0, 4), parts.slice(4).join('')];
    }

    const ext = path.extname(meta.filename ?? '') || '.bin';
    return `${parts.join('/')}${ext}`;
  }

  static toReadable(input: BinaryType): Readable {
    if (this.isReadable(input)) {
      return input;
    } else if (Buffer.isBuffer(input)) {
      return Readable.from(input);
    } else if (this.isArrayBuffer(input)) {
      return Readable.from(Buffer.from(input));
    } else if (input instanceof Blob) {
      return Readable.fromWeb(input.stream());
    } else if (this.isReadableStream(input)) {
      return Readable.fromWeb(input);
    } else if (this.isUint8Array(input)) {
      return Readable.from(Buffer.from(input));
    } else {
      return Readable.from(input);
    }
  }

  static toByteStream(input: BinaryType): ByteStream {
    if (this.isByteStream(input)) {
      return input;
    } else {
      return this.toReadable(input);
    }
  }

  static toReadableStream(input: BinaryType): ReadableStream {
    if (this.isReadableStream(input)) {
      return input;
    } else if (this.isReadable(input)) {
      return Readable.toWeb(input);
    } else if (input instanceof Blob) {
      return input.stream();
    } else {
      return Readable.toWeb(this.toReadable(input));
    }
  }

  static toBuffer(input: BinaryType | undefined): Promise<Buffer> {
    return this.toByteArray(input);
  }

  static toByteArray(input: BinaryType | undefined): Promise<Buffer> {
    if (input === undefined || input === null) {
      return Promise.resolve(Buffer.alloc(0));
    } else if (Buffer.isBuffer(input)) {
      return Promise.resolve(input);
    } else if (this.isArrayBuffer(input)) {
      return Promise.resolve(Buffer.from(input));
    } else if (this.isUint8Array(input)) {
      return Promise.resolve(Buffer.from(input));
    } else if (input instanceof Blob) {
      return input.arrayBuffer().then(data => Buffer.from(data));
    } else if (this.isReadableStream(input)) {
      return consumers.buffer(input);
    } else if (this.isReadable(input)) {
      return consumers.buffer(input);
    } else {
      return consumers.buffer(Readable.from(input));
    }
  }

  /**
   * Convert input to Basic Binary Type or undefined if not matching
   */
  static toNodeType(input?: unknown): Readable | Buffer | undefined {
    if (input === null || input === undefined) {
      return Buffer.alloc(0);
    } else if (input instanceof Blob) {
      return Readable.fromWeb(input.stream());
    } else if (this.isReadableStream(input)) {
      return Readable.fromWeb(input);
    } else if (this.isReadable(input)) {
      return input;
    } else if (this.isAsyncIterable(input)) {
      return Readable.from(input);
    } else if (this.isArrayBuffer(input)) {
      return Buffer.from(input);
    } else if (this.isUint8Array(input) || Buffer.isBuffer(input)) {
      return Buffer.from(input);
    }
    return undefined;
  }

  static getMetadata(input: BinaryType, metadata: BinaryMetadata = {}): BinaryMetadata {
    if (input instanceof Blob) {
      const withMeta: Blob & { [BlobMetaSymbol]?: BinaryMetadata } = input;
      metadata = { ...withMeta[BlobMetaSymbol], ...metadata };
      metadata.size ??= input.size;
    } else if (this.isByteArray(input)) {
      metadata.size = input.byteLength;
    } else if (input instanceof FileReadStream) {
      metadata.filename ??= path.basename(input.path.toString());
      metadata.size ??= statSync(input.path.toString()).size;
    }
    return metadata;
  }

  /**
   * Enforce byte range for stream stream/file of a certain size
   */
  static enforceRange({ start, end }: ByteRange, size: number): Required<ByteRange> {
    // End is inclusive
    end = Math.min(end ?? (size - 1), size - 1);

    if (Number.isNaN(start) || Number.isNaN(end) || !Number.isFinite(start) || start >= size || start < 0 || start > end) {
      throw new AppError('Invalid position, out of range', { category: 'data', details: { start, end, size } });
    }

    return { start, end };
  }

  /**
   * Generate buffer from hex string
   */
  static fromHexString(value: string): Buffer {
    return Buffer.from(value, 'hex');
  }

  /**
   * Convert hex bytes to string
   */
  static toHexString(value: Buffer | Uint8Array | ArrayBuffer): string {
    if (this.isArrayBuffer(value)) {
      value = Buffer.from(value);
    } else if (!Buffer.isBuffer(value) && this.isUint8Array(value)) {
      value = Buffer.from(value);
    }
    return value.toString('hex');
  }

  /**
   * Return buffer from base64 string
   */
  static fromBase64String(value: string): Buffer {
    return Buffer.from(value, 'base64');
  }

  /**
   * Convert value to base64 string
   */
  static toBase64String(value: Buffer | Uint8Array | ArrayBuffer): string {
    if (this.isArrayBuffer(value)) {
      value = Buffer.from(value);
    } else if (!Buffer.isBuffer(value) && this.isUint8Array(value)) {
      value = Buffer.from(value);
    }
    return value.toString('base64');
  }

  /**
   * Return buffer from utf8 string
   */
  static fromUTF8String(value: string): Buffer {
    return Buffer.from(value, 'utf8');
  }

  /**
   * Return utf8 string from bytes
   */
  static toUTF8String(value: ByteArray): string {
    if (this.isArrayBuffer(value)) {
      value = Buffer.from(value);
    } else if (!Buffer.isBuffer(value) && this.isUint8Array(value)) {
      value = Buffer.from(value);
    }
    return value.toString('utf8');
  }

  /**
   * Convert utf8 value to base64 value string
   */
  static utf8ToBase64(value: string | Buffer): string {
    return (Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8')).toString('base64');
  }

  /**
   * Convert base64 value to utf8 string
   */
  static base64ToUTF8(value: string | Buffer): string {
    return (Buffer.isBuffer(value) ? value : Buffer.from(value, 'base64')).toString('utf8');
  }

  static readChunksAsBuffer(chunk: Any, encoding?: BufferEncoding | null): Buffer {
    return Buffer.isBuffer(chunk) ? chunk :
      this.isUint8Array(chunk) ? Buffer.from(chunk) :
        this.isArrayBuffer(chunk) ? Buffer.from(chunk) :
          typeof chunk === 'string' ? Buffer.from(chunk, encoding ?? 'utf8') :
            Buffer.from(`${chunk}`, 'utf8');
  }

  static combineByteArrays(arrays: Buffer[]): Buffer {
    return Buffer.concat(arrays);
  }

  static detectEncoding(input: BinaryType): BufferEncoding | undefined {
    if (this.isReadable(input)) {
      return input.readableEncoding!;
    }
  }

  static sliceByteArray(input: ByteArray, start: number, end?: number): ByteArray {
    if (Buffer.isBuffer(input)) {
      return input.subarray(start, end);
    } else if (this.isArrayBuffer(input)) {
      return input.slice(start, end);
    } else {
      return input.slice(start, end);
    }
  }
}