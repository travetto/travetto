import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ReadableStream } from 'node:stream/web';
import { text as toText, arrayBuffer as toBuffer } from 'node:stream/consumers';

import { BinaryInput, BlobMeta } from './types';
import { AppError } from './error';

/**
 * Common functions for dealing with binary data/streams
 */
export class BinaryUtil {

  /**
   * Generate a proper sha512 hash from a src value
   * @param src The seed value to build the hash from
   * @param len The optional length of the hash to generate
   */
  static hash(src: string, len: number = -1): string {
    const hash = crypto.createHash('sha512');
    hash.update(src);
    const ret = hash.digest('hex');
    return len > 0 ? ret.substring(0, len) : ret;
  }

  /**
   * Compute hash from an input blob, buffer or readable stream.
   */
  static async hashInput(input: BinaryInput): Promise<string> {
    const hash = crypto.createHash('sha256').setEncoding('hex');
    if (Buffer.isBuffer(input)) {
      hash.write(input);
    } else if (input instanceof Blob) {
      await pipeline(Readable.fromWeb(input.stream()), hash);
    } else {
      await pipeline(input, hash);
    }
    return hash.digest('hex').toString();
  }

  /**
   * Write file and copy over when ready
   */
  static async bufferedFileWrite(file: string, content: string, checkHash = false): Promise<void> {
    if (checkHash) {
      const current = await fs.readFile(file, 'utf8').catch(() => '');
      if (this.hash(current) === this.hash(content)) {
        return;
      }
    }

    const temp = path.resolve(os.tmpdir(), `${process.hrtime()[1]}.${path.basename(file)}`);
    await fs.writeFile(temp, content, 'utf8');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.rename(temp, file);
  }

  /**
   * Make a blob, and assign metadata
   */
  static readableBlob(input: () => (Readable | Promise<Readable>), metadata: BlobMeta): Blob {
    const stream = new PassThrough();
    const go = (): Readable => {
      Promise.resolve(input()).then(v => v.pipe(stream), (err) => stream.destroy(err));
      return stream;
    };

    const size = metadata.range ? (metadata.range.end - metadata.range.start) + 1 : metadata.size;
    const out: Blob = metadata.filename ?
      new File([], path.basename(metadata.filename), { type: metadata.contentType }) :
      new Blob([], { type: metadata.contentType });

    Object.defineProperties(out, {
      size: { value: size },
      stream: { value: () => ReadableStream.from(go()) },
      arrayBuffer: { value: () => toBuffer(go()) },
      text: { value: () => toText(go()) },
      bytes: { value: () => toBuffer(go()).then(v => new Uint8Array(v)) },
    });

    // @ts-expect-error
    out.meta = metadata;

    return out;
  }

  /**
   * Write limiter
   * @returns
   */
  static limitWrite(maxSize: number): Transform {
    let read = 0;
    return new Transform({
      transform(chunk, encoding, callback): void {
        read += (Buffer.isBuffer(chunk) || typeof chunk === 'string') ? chunk.length : (chunk instanceof Uint8Array ? chunk.byteLength : 0);
        if (read > maxSize) {
          callback(new AppError('File size exceeded', 'data', { read, size: maxSize }));
        } else {
          callback(null, chunk);
        }
      },
    });
  }
}