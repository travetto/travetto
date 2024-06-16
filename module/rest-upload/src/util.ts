import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import stream, { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { path } from '@travetto/manifest';
import { AppError } from '@travetto/base';

import { LocalFile } from './file';

export type WithCleanup<T> = [T, () => Promise<void>];

/**
 * General support for handling file uploads/downloads
 */
export class RestUploadUtil {

  static async #createTempFileWithCleanup(filename: string): Promise<WithCleanup<string>> {
    // TODO: Should use file abstraction
    const rnd = Math.trunc(Math.random() * 1000).toString(36);
    const uniqueDir = path.resolve(os.tmpdir(), `upload_${Date.now()}_${rnd}`);
    await fs.mkdir(uniqueDir, { recursive: true });
    const uniqueLocal = path.resolve(uniqueDir, path.basename(filename));

    const cleanup = (): Promise<void> => fs.rm(uniqueDir, { force: true, recursive: true }).catch(() => { });

    return [uniqueLocal, cleanup];
  }

  static async #streamToFileWithMaxSize(inputStream: stream.Readable, outputFile: string, maxSize?: number): Promise<void> {
    if (!maxSize || maxSize < 0) {
      return pipeline(inputStream, createWriteStream(outputFile));
    }

    let read = 0;

    await pipeline(
      inputStream,
      new stream.Transform({
        transform(chunk, encoding, callback): void {
          read += (Buffer.isBuffer(chunk) || typeof chunk === 'string') ? chunk.length : 0;
          if (read > maxSize) {
            callback(new AppError('File size exceeded', 'data'));
          } else {
            callback(null, chunk);
          }
        },
      }),
      createWriteStream(outputFile)
    );
  }

  /**
   * File to blob
   * @param file
   * @param metadata
   */
  static async fileToBlob(file: string, metadata: Partial<{ contentType?: string }> = {}): Promise<File> {
    let type = metadata.contentType;
    if (!type) {
      const { default: fileType } = await import('file-type');
      let buffer: Buffer;
      const fd = await fs.open(file, 'r');
      try {
        buffer = Buffer.alloc(4100);
        await fd.read(buffer, 0, 4100, 0);
      } finally {
        try { fd.close(); } catch { }
      }

      const matched = await fileType.fromBuffer(buffer);
      if (matched?.mime === 'video/mp4' && file.endsWith('.m4a')) {
        type = 'audio/mpeg';
      }
    }
    return new LocalFile(file, type);
  }

  /**
   * Write data to file, enforcing max size if needed
   * @param data
   * @param filename
   * @param maxSize
   */
  static async writeToBlob(data: stream.Readable | Buffer, filename: string, maxSize?: number): Promise<WithCleanup<File>> {
    const [uniqueLocal, cleanup] = await this.#createTempFileWithCleanup(filename);

    try {
      await this.#streamToFileWithMaxSize(Buffer.isBuffer(data) ? Readable.from(data) : data, uniqueLocal, maxSize);
    } catch (err) {
      await cleanup();
      throw err;
    }

    const file = await this.fileToBlob(uniqueLocal);
    return [file, cleanup];
  }
}