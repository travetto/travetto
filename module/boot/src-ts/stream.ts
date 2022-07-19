import { createWriteStream } from 'fs';
import { PassThrough, Readable, Writable } from 'stream';

type All = Buffer | string | Readable | Uint8Array;

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
  static async streamToBuffer(src: Readable): Promise<Buffer> {
    return new Promise<Buffer>((res, rej) => {
      const data: Buffer[] = [];
      src.on('data', d => data.push(d));
      src.on('error', rej);
      src.on('end', (err: unknown) => {
        err ? rej(err) : res(Buffer.concat(data));
      });
    });
  }

  /**
   * Convert input source to a buffer
   * @param src The input to convert to a buffer
   */
  static async toBuffer(src: All): Promise<Buffer> {
    if (src instanceof Buffer) {
      return src;
    } else if (src instanceof Uint8Array) {
      return Buffer.from(src);
    } else if (typeof src !== 'string' && 'pipe' in src) {
      return this.streamToBuffer(src);
    } else {
      return Buffer.from(src, src.endsWith('=') ? 'base64' : 'utf8');
    }
  }

  /**
   * Convert input source to a stream
   * @param src The input to convert to a stream
   */
  static async toStream(src: All): Promise<Readable> {
    if (typeof src !== 'string' && 'pipe' in src) {
      return src;
    } else {
      return this.bufferToStream(await this.toBuffer(src));
    }
  }

  /**
   * Persist to a file
   * @param src The input to write to file
   * @param out The location to write to
   */
  static async writeToFile(src: All, out: string): Promise<void> {
    const write = createWriteStream(out);
    const finalStream = (await this.toStream(src)).pipe(write);
    await new Promise((res, rej) => {
      finalStream.on('finish', res).on('error', rej);
    });
    return;
  }

  /**
   * Delay ending stream until some milestone is achieved
   * @param stream The stream to wait for
   * @param waitUntil The function to track completion before the stream is done
   */
  static async waitForCompletion(stream: Readable, waitUntil: () => Promise<unknown>) {
    const ogListen = stream.addListener;

    // Allow for process to end before calling end handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stream.on = stream.addListener = function (this: Readable, type: string, handler: (...params: any[]) => void) {
      let outHandler = handler;
      if (type === 'end') {
        outHandler = async (...params: unknown[]) => {
          await waitUntil();
          handler(...params);
        };
      }
      return ogListen.call(this, type, outHandler);
    };
    return stream;
  }

  /**
   * Pipe a stream and wait for completion
   */
  static async pipe(src: Readable, dest: Writable, opts?: { end?: boolean }) {
    await new Promise((succ, rej) => {
      src.on('end', succ)
        .on('drain', succ)
        .on('close', succ)
        .on('error', rej);
      src.pipe(dest, opts);
    });
  }
}