import * as path from 'path';
import { createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as stream from 'stream';

import { Renderable, Request, Response } from '@travetto/rest';
import { Asset, AssetUtil } from '@travetto/asset';
import { StreamUtil, AppError } from '@travetto/base';

export type WithCleanup<T> = [T, () => Promise<unknown | void> | void | unknown];

const FILENAME_EXTRACT = /filename[*]?=["]?([^";]*)["]?/;

/**
 * General support for handling file uploads/downloads
 */
export class AssetRestUtil {

  static async #createTempFileWithCleanup(filename: string): Promise<WithCleanup<string>> {
    // TODO: Should use file abstraction
    const uniqueDir = path.resolve(os.tmpdir(), `upload_${Math.trunc(Date.now() / (1000 * 60))}_${Math.trunc(Math.random() * 100000000).toString(36)}`).__posix;
    await fs.mkdir(uniqueDir, { recursive: true });
    const uniqueLocal = path.resolve(uniqueDir, path.basename(filename)).__posix;

    const cleanup = async (): Promise<void> => {
      try { await fs.unlink(uniqueLocal); } catch { }
      try { await fs.rmdir(uniqueDir); } catch { }
    };

    return [uniqueLocal, cleanup];
  }

  static async #streamToFileWithMaxSize(inputStream: stream.Readable, outputFile: string, maxSize?: number): Promise<void> {
    if (!maxSize || maxSize < 0) {
      return StreamUtil.writeToFile(inputStream, outputFile);
    }

    let read = 0;
    await new Promise((res, rej) => {
      inputStream
        .pipe(new stream.Transform({
          transform(chunk, encoding, callback): void {
            read += (Buffer.isBuffer(chunk) || typeof chunk === 'string') ? chunk.length : 0;
            if (read >= maxSize) {
              callback(new AppError('File size exceeded', 'data'));
            } else {
              callback(null, chunk);
            }
          },
        }))
        .on('error', rej)
        .pipe(createWriteStream(outputFile, { autoClose: true }))
        .on('finish', res)
        .on('error', rej);
    });
  }

  /**
   * Write data to file, enforcing max size if needed
   * @param data
   * @param filename
   * @param maxSize
   */
  static async writeToAsset(data: stream.Readable | Buffer, filename: string, maxSize?: number): Promise<WithCleanup<Asset>> {
    const [uniqueLocal, cleanup] = await this.#createTempFileWithCleanup(filename);

    try {
      await this.#streamToFileWithMaxSize(await StreamUtil.toStream(data), uniqueLocal, maxSize);
    } catch (err) {
      await cleanup();
      throw err;
    }

    const asset = await AssetUtil.fileToAsset(uniqueLocal);
    return [asset, cleanup];
  }

  /**
   * Parse filename from the request headers
   */
  static getFileName(req: Request): string {
    const [, match] = (req.header('content-disposition') ?? '').match(FILENAME_EXTRACT) ?? [];
    return match ?? `file-upload.${req.getContentType()?.subtype ?? 'unknown'}`;
  }

  /**
   * Make any asset downloadable
   */
  static downloadable(asset: Asset): Renderable {
    return {
      render(res: Response): stream.Readable {
        res.status(200);
        res.setHeader('Content-Type', asset.contentType);
        res.setHeader('Content-Disposition', `attachment;filename=${path.basename(asset.filename)}`);
        return asset.stream!();
      }
    };
  }
}