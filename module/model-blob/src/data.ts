import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';

/**
 * Basic data utils
 */
export class BlobDataUtil {

  /**
   * Compute hash from a file location on disk or a blob
   */
  static async computeHash(input: Readable | Blob | Buffer): Promise<string> {
    const hash = crypto.createHash('sha256').setEncoding('hex');
    const str = Buffer.isBuffer(input) ?
      Readable.from(input) :
      input instanceof Blob ?
        Readable.fromWeb(input.stream()) :
        input;
    await pipeline(str, hash);
    return hash.read().toString();
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
    return this.computeHash(await this.fetchBytes(url, byteLimit));
  }
}