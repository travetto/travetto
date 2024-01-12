import rl from 'node:readline/promises';
import { createWriteStream } from 'node:fs';
import { PassThrough, Readable, Writable } from 'node:stream';
import { ReadableStream as WebReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';

type All = Buffer | string | Readable | Uint8Array | NodeJS.ReadableStream | WebReadableStream;

export class MemoryWritable extends Writable {
  data: Buffer[] = [];

  toBuffer(encoding: BufferEncoding): string;
  toBuffer(): Buffer;
  toBuffer(encoding?: BufferEncoding): Buffer | string {
    const buffer = Buffer.concat(this.data);
    return encoding ? buffer.toString(encoding) : buffer;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _write(chunk: any, encoding: string, callback: (err?: Error) => void): void {
    this.data.push(chunk);
    callback();
  }
}

/**
 * Utilities for managing streams/buffers/etc
 */
export class StreamUtil {

  /**
   * Convert buffer to a stream
   * @param src The buffer to stream
   */
  static async bufferToStream(src: Buffer): Promise<Readable> {
    const readable = new PassThrough();
    readable.end(src);
    return readable;
  }

  /**
   * Read stream to buffer
   * @param src The stream to convert to a buffer
   */
  static async streamToBuffer(src: Readable | NodeJS.ReadableStream | WebReadableStream): Promise<Buffer> {
    if ('getReader' in src) {
      return this.streamToBuffer(Readable.fromWeb(src));
    }
    const buffer = new MemoryWritable();
    await pipeline(src, buffer);
    return buffer.toBuffer();
  }

  /**
   * Convert input source (file, string, readable) to a buffer
   * @param src The input to convert to a buffer
   */
  static async toBuffer(src: All): Promise<Buffer> {
    if (src instanceof Buffer) {
      return src;
    } else if (src instanceof Uint8Array) {
      return Buffer.from(src);
    } else if (typeof src !== 'string' && ('pipe' in src || 'getReader' in src)) {
      return this.streamToBuffer(src);
    } else {
      return Buffer.from(src, src.endsWith('=') ? 'base64' : 'utf8');
    }
  }

  /**
   * Convert input source (file, buffer, readable, string) to a stream
   * @param src The input to convert to a stream
   */
  static async toStream(src: All): Promise<Readable> {
    if (typeof src !== 'string' && 'pipe' in src) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return src as Readable;
    } else if (typeof src !== 'string' && 'getReader' in src) {
      return Readable.fromWeb(src);
    } else {
      return this.bufferToStream(await this.toBuffer(src));
    }
  }

  /**
   * Persist (readable, buffer, string, or file) to a file
   * @param src The input to write to file
   * @param out The location to write to
   */
  static async writeToFile(src: All, out: string): Promise<void> {
    await pipeline(await this.toStream(src), createWriteStream(out));
  }

  /**
   * Read all lines of a given readable
   */
  static async onLine(stream: Readable | null | undefined, cb: (line: string) => unknown): Promise<void> {
    if (stream) {
      for await (const line of rl.createInterface(stream)) {
        await cb(line.trimEnd());
      }
    }
  }
}