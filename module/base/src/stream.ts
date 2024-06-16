import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { ReadableStream as WebReadableStream } from 'node:stream/web';

import { AppError } from './error';

type All = Buffer | string | Readable | Uint8Array | NodeJS.ReadableStream | WebReadableStream;

/**
 * Utilities for managing streams/buffers/etc
 */
export class StreamUtil {

  /**
   * Convert input source (file, buffer, readable, string) to a stream
   * @param src The input to convert to a stream
   */
  static async toStream(src: All): Promise<Readable> {
    if (typeof src === 'string') {
      return Readable.from(src, { encoding: src.endsWith('=') ? 'base64' : 'utf8' });
    } else if ('pipe' in src) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return src as Readable;
    } else if ('getReader' in src) {
      return Readable.fromWeb(src);
    } else {
      return Readable.from(src);
    }
  }

  /**
   * Read a chunk from a file
   */
  static async readChunk(input: string | Readable | Buffer, bytes: number): Promise<Buffer> {
    if (Buffer.isBuffer(input)) {
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
   * Fetch bytes from a url
   */
  static async fetchBytes(url: string, byteLimit: number = -1): Promise<Buffer> {
    const str = await fetch(url, {
      headers: (byteLimit > 0) ? {
        Range: `0-${byteLimit - 1}`
      } : {}
    });

    if (!str.ok) {
      throw new AppError('Invalid url for hashing', 'data');
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
}