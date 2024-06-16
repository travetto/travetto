import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import stream, { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { path } from '@travetto/manifest';
import { StreamUtil, AppError } from '@travetto/base';

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
   * Detect file type from location on disk
   */
  static async detectFileType(input: string | Buffer | Readable): Promise<{ ext: string, mime: string } | undefined> {
    const { default: fileType } = await import('file-type');
    const buffer = await StreamUtil.readChunk(input, 4100);
    const matched = await fileType.fromBuffer(buffer);
    if (typeof input === 'string' && matched?.mime === 'video/mp4' && input.endsWith('.m4a')) {
      return { ext: '.m4a', mime: 'audio/mpeg' };
    }
    return matched;
  }

  /**
   * File to blob
   * @param file
   * @param metadata
   */
  static async fileToBlob(file: string, metadata: Partial<{ contentType?: string }> = {}): Promise<File> {
    let type = metadata.contentType;
    if (!type) {
      type = (await this.detectFileType(file))?.mime;
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