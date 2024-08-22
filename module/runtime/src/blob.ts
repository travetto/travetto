import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { ReadableStream } from 'node:stream/web';
import { text as toText, arrayBuffer as toBuffer } from 'node:stream/consumers';
import { PassThrough, Readable } from 'node:stream';

import { BinaryInput, castTo } from './types';
import { AppError } from './error';

const BLOB_META = Symbol.for('@travetto/runtime:blob-meta');

/**
 * Range of bytes, inclusive
 */
export type ByteRange = { start: number, end?: number };

export interface BlobMeta {
  /** Size of blob */
  size?: number;
  /** Mime type of the content */
  contentType?: string;
  /** Hash of blob contents */
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
  /** Byte range for blob */
  range?: Required<ByteRange>;
}

export class BlobUtil {

  /**
   * Setting blob meta
   */
  static setBlobMeta(blob: Blob, meta: BlobMeta): void {
    castTo<{ [BLOB_META]?: BlobMeta }>(blob)[BLOB_META] = meta;
  }

  /**
   * Getting blob meta
   */
  static getBlobMeta(blob: Blob): BlobMeta | undefined {
    return castTo<{ [BLOB_META]?: BlobMeta }>(blob)[BLOB_META];
  }

  /**
   * Make a blob, and assign metadata
   */
  static async lazyStreamBlob(input: () => (Readable | Promise<Readable>), metadata: BlobMeta): Promise<Blob> {
    const stream = new PassThrough();
    const go = (): Readable => {
      Promise.resolve(input()).then(v => v.pipe(stream), (err) => stream.destroy(err));
      return stream;
    };

    const size = metadata.range ? (metadata.range.end - metadata.range.start) + 1 : metadata.size;
    const out: Blob = metadata.filename ?
      new File([], path.basename(metadata.filename), { type: metadata.contentType }) :
      new Blob([], { type: metadata.contentType });

    Object.defineProperties(out, {
      size: { value: size },
      stream: { value: () => ReadableStream.from(go()) },
      arrayBuffer: { value: () => toBuffer(go()) },
      text: { value: () => toText(go()) },
      buffer: { value: () => toBuffer(go()).then(v => new Uint8Array(v)) },
    });

    this.setBlobMeta(out, metadata);

    return out;
  }

  /**
   * Convert file to a blob, backed by file system
   */
  static async fileBlob(src: string, metadata: BlobMeta = {}): Promise<File> {
    return castTo(this.lazyStreamBlob(() => createReadStream(src, metadata.range), {
      ...metadata,
      filename: src,
      size: metadata.size ?? (await fs.stat(src)).size,
    }));
  }

  /**
   * Convert input to a blob, containing all data in memory
   */
  static async memoryBlob(src: BinaryInput, metadata: BlobMeta = {}): Promise<Blob> {
    let buffer: Buffer;
    let type: string | undefined;
    if (src instanceof Blob) {
      type = src.type;
      buffer = Buffer.from(await src.arrayBuffer());
      metadata = { ...this.getBlobMeta(src), ...metadata };
    } else if (typeof src === 'object' && 'pipeThrough' in src) {
      buffer = Buffer.from(await toBuffer(src));
    } else if (typeof src === 'object' && 'pipe' in src) {
      buffer = Buffer.from(await toBuffer(src));
    } else {
      buffer = src;
    }

    return await this.lazyStreamBlob(() => Readable.from(buffer), {
      ...metadata,
      contentType: metadata.contentType ?? type,
      size: metadata.size ?? buffer.length,
    });
  }


  /**
   * Convert input to a blob, containing all data in memory
   */
  static async streamBlob(src: BinaryInput, metadata: BlobMeta = {}): Promise<Blob> {
    let input: () => (Readable | Promise<Readable>);
    let type: string | undefined;
    let size: number | undefined;
    if (src instanceof Blob) {
      type = src.type;
      size = src.size;
      metadata = { ...this.getBlobMeta(src), ...metadata };
      input = async (): Promise<Readable> => Readable.fromWeb(src.stream());
    } else if (typeof src === 'object' && 'pipeThrough' in src) {
      input = (): Readable => Readable.fromWeb(src);
    } else if (typeof src === 'object' && 'pipe' in src) {
      input = (): Readable => src;
    } else {
      size = src.length;
      input = (): Readable => Readable.from(src);
    }

    return await this.lazyStreamBlob(input, {
      ...metadata,
      contentType: metadata.contentType ?? type,
      size: metadata.size ?? size,
    });
  }

  /**
   * Enforce byte range for stream stream/file of a certain size
   */
  static enforceRange({ start, end }: ByteRange, size: number): Required<ByteRange> {
    // End is inclusive
    end = Math.min(end ?? (size - 1), size - 1);

    if (Number.isNaN(start) || Number.isNaN(end) || !Number.isFinite(start) || start >= size || start < 0 || start > end) {
      throw new AppError('Invalid position, out of range', 'data');
    }

    return { start, end };
  }
}