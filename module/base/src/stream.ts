import fs from 'fs/promises';
import { createWriteStream, createReadStream } from 'fs';
import { PassThrough, Readable, Writable } from 'stream';
import rl from 'readline';

import { path } from '@travetto/manifest';

import type { ExecutionState } from './exec';

type All = Buffer | string | Readable | Uint8Array | NodeJS.ReadableStream;

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
  static async streamToBuffer(src: Readable | NodeJS.ReadableStream): Promise<Buffer> {
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
    } else if (typeof src !== 'string' && 'pipe' in src) {
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
   * Stream lines from file, supporting asynchronous processing.  Will watch a file for
   * any line changes, and produce those changes as asynchronous iterable stream.
   *
   * Functionally, this is equivalent to using the Unix tail operation on a file.
   */
  static async * streamLines(file: string, ensureEmpty = false): AsyncIterable<string> {
    await fs.mkdir(path.dirname(file), { recursive: true });

    // Ensure file
    if (!await fs.stat(file).catch(() => false)) {
      await fs.appendFile(file, '', 'utf8');
    }

    let read = 0;

    async function* streamFile(): AsyncGenerator<string, boolean> {
      const stat = await fs.stat(file).catch(() => undefined);
      if (!stat || stat.size < read) {
        return false; // Truncated or missing
      } else if (stat.size === read) {
        return true; // Unchanged
      }

      const stream = await createReadStream(file, { autoClose: true, emitClose: true, encoding: 'utf8', start: read });
      const reader = rl.createInterface(stream);
      for await (const line of reader) {
        read += line.length;
        if (line.trim()) {
          yield line.trim();
        }
      }

      return true;
    }

    if (ensureEmpty) {
      await fs.truncate(file);
    } else {
      yield* streamFile();
    }

    for await (const _ of fs.watch(file, { persistent: true })) {
      const valid = yield* streamFile();
      if (!valid) {
        return;
      }
    }
  }
}