import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PassThrough, Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { getExtension, getType } from 'mime';

import { AppError, castTo } from '@travetto/runtime';

import { BinaryInput } from './types';

/**
 * Common functions for dealing with binary data/streams
 */
export class IOUtil {

  /**
   * Compute hash from an input blob, buffer or readable stream.
   *
   * For Readable/Blob this will most likely consume the data
   */
  static async hashInput(input: BinaryInput): Promise<string> {
    const hash = crypto.createHash('sha256').setEncoding('hex');
    if (Buffer.isBuffer(input)) {
      hash.write(input);
    } else if (input instanceof Blob) {
      hash.write(await input.arrayBuffer());
    } else {
      await pipeline(input, hash);
    }
    return hash.digest('hex').toString();
  }

  /**
   * Fetch bytes from a url
   */
  static async fetchBytes(url: string, byteLimit: number = -1): Promise<Buffer> {
    const str = await fetch(url, {
      headers: (byteLimit > 0) ? {
        Range: `0-${byteLimit - 1}`
      } : {}
    });

    if (!str.ok) {
      throw new Error('Invalid url for hashing');
    }

    let count = 0;
    const buffer: Buffer[] = [];

    for await (const chunk of Readable.fromWeb(str.body!)) {
      if (Buffer.isBuffer(chunk)) {
        buffer.push(chunk);
        count += chunk.length;
      } else if (typeof chunk === 'string') {
        buffer.push(Buffer.from(chunk));
        count += chunk.length;
      }

      if (count > byteLimit && byteLimit > 0) {
        break;
      }
    }

    try {
      await str.body?.cancel();
    } catch { }

    return Buffer.concat(buffer, byteLimit <= 0 ? undefined : byteLimit);
  }

  /**
   * Compute hash from a url
   */
  static async hashUrl(url: string, byteLimit = -1): Promise<string> {
    return this.hashInput(await this.fetchBytes(url, byteLimit));
  }

  /**
   * Get a stream as a lazy value
   * @param src
   * @returns
   */
  static getLazyStream(src: () => (Promise<Readable> | Readable)): () => Readable {
    const out = new PassThrough();
    const run = (): void => { Promise.resolve(src()).then(v => v.pipe(out), (err) => out.destroy(err)); };
    return () => (run(), out);
  }

  /**
   * Read a chunk from a file
   */
  static async readChunk(input: BinaryInput | string, bytes: number): Promise<Buffer> {
    if (input instanceof Blob) {
      return input.slice(0, bytes).arrayBuffer().then(v => Buffer.from(v));
    } else if (Buffer.isBuffer(input)) {
      return input.subarray(0, bytes);
    } else if (typeof input === 'string') {
      const fd = await fs.open(input, 'r');
      try {
        const buffer = Buffer.alloc(bytes);
        await fd.read(buffer, 0, bytes, 0);
        return buffer;
      } finally {
        try { fd.close(); } catch { }
      }
    } else {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of input) {
        const bChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(bChunk);
        if ((size += bChunk.length) >= bytes) {
          break;
        }
      }
      return Buffer.concat(chunks).subarray(0, bytes);
    }
  }

  /**
   * Stream from input to output, enforcing a max size
   */
  static async streamWithMaxSize(input: Readable, output: Writable, maxSize: number): Promise<void> {
    let read = 0;

    await pipeline(
      input,
      new Transform({
        transform(chunk, encoding, callback): void {
          read += (Buffer.isBuffer(chunk) || typeof chunk === 'string') ? chunk.length : 0;
          if (read > maxSize) {
            callback(new AppError('File size exceeded', 'data'));
          } else {
            callback(null, chunk);
          }
        },
      }),
      output
    );
  }

  /**
   * Get extension for a given content type
   * @param contentType
   */
  static getExtension(contentType: string): string | undefined {
    const res = getExtension(contentType)!;
    if (res === 'mpga') {
      return 'mp3';
    }
    return res;
  }

  /**
   * Detect file type
   */
  static async detectType(input: BinaryInput | string, filename?: string): Promise<{ ext: string, mime: string }> {
    if (typeof input === 'string') {
      filename = input;
    }
    const { default: fileType } = await import('file-type');
    const buffer = await this.readChunk(input, 4100);
    const matched = await fileType.fromBuffer(buffer);

    if (!matched && (filename || input instanceof File)) {
      const mime = getType(filename || castTo<File>(input).name);
      if (mime) {
        const ext = this.getExtension(mime)!;
        if (ext) {
          return { ext, mime };
        }
      }
    }

    filename ??= (input instanceof File ? input.name : undefined);

    if (matched?.ext === 'wav') {
      return { ext: 'wav', mime: 'audio/wav' };
    }
    if (matched?.mime === 'video/mp4' && filename?.endsWith('.m4a')) {
      return { ext: 'm4a', mime: 'audio/mp4' };
    }
    if (matched?.ext === castTo('mpga')) {
      return { ext: 'mp3', mime: 'audio/mpeg' };
    }
    if (matched) {
      return matched;
    } else {
      return { ext: 'bin', mime: 'application/octet-stream' };
    }
  }
}