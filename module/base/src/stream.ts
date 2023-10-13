import { watch as watchFile, stat as statFile } from 'fs/promises';
import { createWriteStream, createReadStream } from 'fs';
import { PassThrough, Readable, Writable } from 'stream';
import { ReadableStream as WebReadableStream } from 'stream/web';

import type { ExecutionState } from './exec';

type All = Buffer | string | Readable | Uint8Array | NodeJS.ReadableStream | WebReadableStream;

type StreamOptions = { start?: number, encoding?: BufferEncoding, includeDelimiter?: boolean, delimiter?: string };

/**
 * Utilities for managing streams/buffers/etc
 */
export class StreamUtil {

  /**      console.log!('Received chunk', chunk);

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
    const write = createWriteStream(out);
    const finalStream = (await this.toStream(src)).pipe(write);
    await new Promise((res, rej) => {
      finalStream.on('finish', res).on('error', rej);
    });
    return;
  }

  /**
   * Delay ending stream until 'waitUntil' is resolved
   * @param stream The stream to wait for
   * @param waitUntil The function to track completion before the stream is done
   */
  static async waitForCompletion(stream: Readable, waitUntil: () => Promise<unknown>): Promise<Readable> {
    const ogListen = stream.addListener;

    // Allow for process to end before calling end handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stream.on = stream.addListener = function (this: Readable, type: string, handler: (...params: any[]) => void): Readable {
      let outHandler = handler;
      if (type === 'end') {
        outHandler = async (...params: unknown[]): Promise<void> => {
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
  static async pipe(src: Readable, dest: Writable, opts?: { end?: boolean }): Promise<void> {
    await new Promise((res, rej) => {
      src.on('end', res)
        .on('drain', res)
        .on('close', res)
        .on('error', rej);
      src.pipe(dest, opts);
    });
  }

  /**
   * Pipe a buffer into an execution state
   * @param state The execution state to pipe
   * @param input The data to input into the process
   */
  static async execPipe<T extends Buffer | Readable>(state: ExecutionState, input: T): Promise<T> {
    const { process: proc, result: prom } = state;

    (await this.toStream(input)).pipe(proc.stdin!);

    if (input instanceof Buffer) { // If passing buffers
      const buf = this.toBuffer(proc.stdout!);
      await prom;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return buf as Promise<T>;
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return this.waitForCompletion(proc.stdout!, () => prom) as Promise<T>;
    }
  }

  /**
   * Stream by delimiter from a file, returning the bytes read, for chunked resuming
   * @param file The file to stream from
   * @param options Stream options, including delimiter control
   */
  static async * streamByDelimiter(file: string | Readable, options: StreamOptions = {}): AsyncIterable<{ item: string, read: number }> {
    let read = options.start ?? 0;
    const stream = typeof file === 'string' ? createReadStream(file, { autoClose: true, emitClose: true, start: read }) : file;
    const encoding = options.encoding ?? 'utf8';
    const includeDelimiter = !!options.includeDelimiter;
    const delimiter = options.delimiter ?? '\n';

    let buffer: Buffer = Buffer.from([]);
    for await (const chunk of stream) {
      const chunkBuff: Buffer = typeof chunk === 'string' ? Buffer.from(chunk, encoding) : chunk;
      buffer = Buffer.concat([buffer, chunkBuff]);
      let pos = buffer.indexOf(delimiter);
      while (pos >= 0) { // If we have a newline
        const fullLength = pos + delimiter.length;
        const outLength = pos + (includeDelimiter ? delimiter.length : 0);
        read += fullLength;
        yield { item: buffer.toString(encoding, 0, outLength), read };
        buffer = Buffer.copyBytesFrom(buffer, fullLength);
        pos = buffer.indexOf(delimiter);
      }
    }
    // Yield on exit, in case of being called in a loop
    await new Promise(r => setTimeout(r, 1));
  }

  /**
   * Stream lines for a given file, with automatic restart after completion by using watch
   * @param file
   * @returns
   */
  static async* streamLines(file: string): AsyncIterable<string> {

    let offset = 0;

    if (!await statFile(file).catch(() => false)) {
      return; // File not found to watch
    }

    for await (const { item, read } of this.streamByDelimiter(file, { start: offset, delimiter: '\n' })) {
      yield item;
      offset = read;
    }

    for await (const _ of watchFile(file, { persistent: true })) {
      if (await statFile(file).then(({ size }) => size < offset, () => true)) {
        return; // We should exit on truncation
      }
      for await (const { item, read } of this.streamByDelimiter(file, { start: offset, delimiter: '\n' })) {
        yield item;
        offset = read;
      }
    }
  }
}