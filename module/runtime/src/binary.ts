import path from 'node:path';
import { isArrayBuffer } from 'node:util/types';
import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ReadableStream } from 'node:stream/web';
import { text as toText, arrayBuffer as toArrayBuffer, buffer as toBuffer } from 'node:stream/consumers';

import { BinaryInput, BlobMeta, hasFunction, hasToJSON } from './types.ts';
import { AppError } from './error.ts';
import { Util } from './util.ts';

const isReadableStream = hasFunction<ReadableStream>('pipeTo');
const isAsyncIterable = (v: unknown): v is AsyncIterable<unknown> =>
  !!v && (typeof v === 'object' || typeof v === 'function') && Symbol.asyncIterator in v;


const BlobMetaSymbol = Symbol();

/**
 * Common functions for dealing with binary data/streams
 */
export class BinaryUtil {

  /**
   * Determine if a value is readable
   */
  static isReadable = hasFunction<Readable>('pipe');

  /**
   * Generate a proper sha512 hash from a src value
   * @param src The seed value to build the hash from
   * @param len The optional length of the hash to generate
   */
  static hash(src: string, len: number = -1): string {
    const hash = crypto.createHash('sha512');
    hash.update(src);
    const ret = hash.digest('hex');
    return len > 0 ? ret.substring(0, len) : ret;
  }

  /**
   * Compute hash from an input blob, buffer or readable stream.
   */
  static async hashInput(input: BinaryInput): Promise<string> {
    const hash = crypto.createHash('sha256').setEncoding('hex');
    if (Buffer.isBuffer(input)) {
      hash.write(input);
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
  static readableBlob(input: () => (Readable | Promise<Readable>), metadata: Omit<BlobMeta, 'filename'> & { filename: string }): File;
  static readableBlob(input: () => (Readable | Promise<Readable>), metadata?: BlobMeta): Blob;
  static readableBlob(input: () => (Readable | Promise<Readable>), metadata: BlobMeta = {}): Blob | File {
    const go = (): Readable => {
      const stream = new PassThrough();
      Promise.resolve(input()).then(v => v.pipe(stream), (err) => stream.destroy(err));
      return stream;
    };

    const size = metadata.range ? (metadata.range.end - metadata.range.start) + 1 : metadata.size;
    const out: Blob = metadata.filename ?
      new File([], path.basename(metadata.filename), { type: metadata.contentType }) :
      new Blob([], { type: metadata.contentType });

    return Object.defineProperties(out, {
      size: { value: size },
      stream: { value: () => ReadableStream.from(go()) },
      arrayBuffer: { value: () => toArrayBuffer(go()) },
      text: { value: () => toText(go()) },
      bytes: { value: () => toArrayBuffer(go()).then(v => new Uint8Array(v)) },
      [BlobMetaSymbol]: { value: metadata }
    });
  }

  /**
   * Get blob metadata
   */
  static getBlobMeta(blob: Blob): BlobMeta | undefined {
    const withMeta: Blob & { [BlobMetaSymbol]?: BlobMeta } = blob;
    return withMeta[BlobMetaSymbol];
  }

  /**
   * Write limiter
   * @returns
   */
  static limitWrite(maxSize: number): Transform {
    let read = 0;
    return new Transform({
      transform(chunk, encoding, callback): void {
        read += (Buffer.isBuffer(chunk) || typeof chunk === 'string') ? chunk.length : (chunk instanceof Uint8Array ? chunk.byteLength : 0);
        if (read > maxSize) {
          callback(new AppError('File size exceeded', { category: 'data', details: { read, size: maxSize } }));
        } else {
          callback(null, chunk);
        }
      },
    });
  }

  /**
   * Get a hashed location/path for a blob
   */
  static hashedBlobLocation(meta: BlobMeta): string {
    const hash = meta.hash ?? Util.uuid();

    let parts = hash.match(/(.{1,4})/g)!.slice();
    if (parts.length > 4) {
      parts = [...parts.slice(0, 4), parts.slice(4).join('')];
    }

    const ext = path.extname(meta.filename ?? '') || '.bin';
    return `${parts.join('/')}${ext}`;
  }

  /**
   * Is src a binary type
   */
  static isBinaryType(src: unknown): boolean {
    return src instanceof Blob || Buffer.isBuffer(src) || BinaryUtil.isReadable(src) ||
      isArrayBuffer(src) || isReadableStream(src) || isAsyncIterable(src);
  }

  /**
   * Get value as node-specific binary value, buffer or readable stream
   */
  static toNodeBinaryValue(src: unknown): Buffer | Readable {
    if (Buffer.isBuffer(src) || this.isReadable(src)) {
      return src;
    } else if (src === undefined || src === null) {
      return Buffer.alloc(0);
    } else if (typeof src === 'string') {
      return Buffer.from(src, 'utf8');
    } else if (isArrayBuffer(src)) {
      return Buffer.from(src);
    } else if (isReadableStream(src)) {
      return Readable.fromWeb(src);
    } else if (src instanceof Error) {
      const text = JSON.stringify(hasToJSON(src) ? src.toJSON() : { message: src.message });
      return Buffer.from(text, 'utf-8');
    } else if (src instanceof Blob) {
      return Readable.fromWeb(src.stream());
    } else if (isAsyncIterable(src)) {
      return Readable.from(src);
    } else {
      const text = JSON.stringify(hasToJSON(src) ? src.toJSON() : src);
      return Buffer.from(text, 'utf-8');
    }
  }

  static async toBuffer(src: Buffer | Readable): Promise<Buffer> {
    return Buffer.isBuffer(src) ? src : toBuffer(src);
  }
}