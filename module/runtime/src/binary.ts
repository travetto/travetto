import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ReadableStream } from 'node:stream/web';
import { text as toText, arrayBuffer as toArrayBuffer } from 'node:stream/consumers';
import { isArrayBuffer } from 'node:util/types';

import { BinaryInput, BlobMeta, hasFunction } from './types.ts';
import { Util } from './util.ts';

const BlobMetaSymbol = Symbol();

/**
 * Common functions for dealing with binary data/streams
 */
export class BinaryUtil {
  /** Is Array Buffer */
  static isArrayBuffer = isArrayBuffer;
  /** Is Readable */
  static isReadable = hasFunction<Readable>('pipe');
  /** Is ReadableStream */
  static isReadableStream = hasFunction<ReadableStream>('pipeTo');
  /** Is Async Iterable */
  static isAsyncIterable = (v: unknown): v is AsyncIterable<unknown> =>
    !!v && (typeof v === 'object' || typeof v === 'function') && Symbol.asyncIterator in v;

  /**
   * Is src a binary type
   */
  static isBinaryType(src: unknown): boolean {
    return src instanceof Blob || Buffer.isBuffer(src) || this.isReadable(src) ||
      this.isArrayBuffer(src) || this.isReadableStream(src) || this.isAsyncIterable(src);
  }

  /**
   * Generate a proper sha512 hash from a src value
   * @param src The seed value to build the hash from
   * @param len The optional length of the hash to generate
   */
  static hash(src: string, len: number = -1): string {
    const hash = crypto.createHash('sha512');
    hash.update(src);
    const digest = hash.digest('hex');
    return len > 0 ? digest.substring(0, len) : digest;
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
}