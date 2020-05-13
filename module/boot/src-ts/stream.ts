import * as fs from 'fs';
import { PassThrough } from 'stream';

type All = Buffer | string | NodeJS.ReadableStream | Uint8Array;

/**
 * Utilities for managing streams/buffers/etc
 */
export class StreamUtil {

  /**
   * Convert buffer to a stream
   */
  static async bufferToStream(src: Buffer): Promise<NodeJS.ReadableStream> {
    const readable = new PassThrough();
    readable.end(src);
    return readable;
  }

  /**
   * Read stream to buffer
   */
  static async streamToBuffer(src: NodeJS.ReadableStream): Promise<Buffer> {
    const stream = src as NodeJS.ReadableStream;
    return new Promise<Buffer>((res, rej) => {
      const data: Buffer[] = [];
      stream.on('data', d => data.push(d));
      stream.on('error', rej);
      stream.on('end', (err: any) => {
        err ? rej(err) : res(Buffer.concat(data));
      });
    });
  }

  /**
   * Convert input source to a buffer
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
   */
  static async toStream(src: All): Promise<NodeJS.ReadableStream> {
    if (typeof src !== 'string' && 'pipe' in src) {
      return src;
    } else {
      return this.bufferToStream(await this.toBuffer(src));
    }
  }

  /**
   * Persist to a file
   */
  static async writeToFile(src: All, out: string): Promise<void> {
    const write = fs.createWriteStream(out);
    const finalStream = (await this.toStream(src)).pipe(write);
    await new Promise((res, rej) => {
      finalStream.on('finish', res).on('error', rej);
    });
    return;
  }

  /**
   * Delay ending stream until some milestone is achieved
   */
  static async waitForCompletion(stream: NodeJS.ReadableStream, waitUntil: () => Promise<any>) {
    const ogListen = stream.addListener;

    // Allow for process to end before calling end handler
    stream.on = stream.addListener = function (this: NodeJS.ReadableStream, type: string, handler: Function) {
      let outHandler = handler;
      if (type === 'end') {
        outHandler = async (...params: any[]) => {
          await waitUntil();
          handler(...params);
        };
      }
      return ogListen.call(this, type, outHandler as any);
    };
    return stream;
  }
}