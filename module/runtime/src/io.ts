import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Common functions for dealing with binary data/streams
 */
export class IOUtil {

  /**
   * Compute hash from an input blob, buffer or readable stream.
   *
   * For Readable/Blob this will most likely consume the data
   */
  static async hashInput(input: Readable | Blob | Buffer): Promise<string> {
    const hash = crypto.createHash('sha256').setEncoding('hex');
    if (Buffer.isBuffer(input)) {
      hash.write(input);
    } else if (input instanceof Blob) {
      hash.write(await input.bytes());
    } else {
      await pipeline(input, hash);
    }
    return hash.read().toString();
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
   * Write file and copy over when ready
   */
  static async bufferedFileWrite(file: string, content: string, checkHash = false): Promise<void> {
    if (checkHash) {
      const current = await fs.readFile(file).catch(() => undefined);
      const currentHash = current ? await this.hashInput(current) : undefined;
      const contentHash = await this.hashInput(Buffer.from(content, 'utf8'));
      if (currentHash === contentHash) {
        return;
      }
    }

    const temp = path.resolve(os.tmpdir(), `${process.hrtime()[1]}.${path.basename(file)}`);
    await fs.writeFile(temp, content, 'utf8');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.rename(temp, file);
  }
}