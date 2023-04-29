import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import stream from 'stream';
import mime from 'mime';

import { Renderable, Request, Response } from '@travetto/rest';
import { Asset, AssetResponse, AssetUtil } from '@travetto/asset';
import { path } from '@travetto/manifest';
import { StreamUtil, AppError } from '@travetto/base';

export type WithCleanup<T> = [T, () => Promise<void>];

const FILENAME_EXTRACT = /filename[*]?=["]?([^";]*)["]?/;

/**
 * General support for handling file uploads/downloads
 */
export class AssetRestUtil {

  static async #createTempFileWithCleanup(filename: string): Promise<WithCleanup<string>> {
    // TODO: Should use file abstraction
    const rnd = Math.trunc(Math.random() * 1000).toString(36);
    const uniqueDir = path.resolve(os.tmpdir(), `upload_${Date.now()}_${rnd}`);
    await fs.mkdir(uniqueDir, { recursive: true });
    const uniqueLocal = path.resolve(uniqueDir, path.basename(filename));

    const cleanup = (): Promise<void> => fs.rm(uniqueDir, { force: true, recursive: true });

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
    if (match) {
      return match;
    } else {
      const contentType = req.getContentType();
      if (contentType) {
        return `file-upload.${mime.getExtension(contentType.full)}`;
      } else {
        return 'file-upload.unknown';
      }
    }
  }

  /**
   * Make any asset downloadable
   */
  static downloadable(asset: AssetResponse): Renderable {
    return {
      render(res: Response): stream.Readable {
        res.setHeader('Content-Type', asset.contentType);
        res.setHeader('Content-Disposition', `attachment;filename=${path.basename(asset.filename)}`);
        if (!asset.range) {
          res.status(200);
        } else {
          const [start, end] = asset.range;
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${asset.size}`);
          res.setHeader('Content-Length', `${end - start + 1}`);
        }
        return asset.stream!();
      }
    };
  }
}