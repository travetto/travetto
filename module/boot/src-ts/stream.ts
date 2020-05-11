import * as fs from 'fs';
import { Readable, PassThrough } from 'stream';

/**
 * Utilities for managing streams/buffers/etc
 */
export class StreamUtil {
  /**
   * Convert input source to a buffer
   */
  static async toBuffer(src: NodeJS.ReadableStream | Buffer | string): Promise<Buffer> {
    if (typeof src === 'string') {
      if (src.endsWith('==')) {
        src = Buffer.from(src, 'base64');
      } else {
        src = fs.createReadStream(src);
      }
    }
    if (src instanceof Buffer) {
      return src;
    } else {
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
  }

  /**
   * Convert input source to a stream
   */
  static toReadable(src: NodeJS.ReadableStream | Buffer | string): NodeJS.ReadableStream {
    if (typeof src === 'string') {
      if (src.endsWith('==')) {
        return this.toReadable(Buffer.from(src, 'base64'));
      } else {
        return fs.createReadStream(src);
      }
    } else if (src instanceof Buffer) {
      const readable = new PassThrough();
      readable.end(src);
      return readable;
    } else {
      return src as Readable;
    }
  }

  /**
   * Persist stream to a file
   */
  static async writeToFile(src: NodeJS.ReadableStream, out: string): Promise<void> {
    const write = fs.createWriteStream(out);
    const finalStream = src.pipe(write);
    await new Promise((res, rej) => {
      finalStream.on('finish', (err) => err ? rej(err) : res());
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