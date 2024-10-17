import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import busboy from '@fastify/busboy';

import { Request, MimeUtil } from '@travetto/rest';
import { NodeEntityⲐ } from '@travetto/rest/src/internal/symbol';
import { AsyncQueue, AppError, castTo, Util, BinaryUtil } from '@travetto/runtime';

import { RestUploadConfig } from './config';

const MULTIPART = new Set(['application/x-www-form-urlencoded', 'multipart/form-data']);

type UploadItem = { stream: Readable, filename?: string, field: string };
type FileType = { ext: string, mime: string };
const RawFileⲐ = Symbol.for('@travetto/rest-upload:raw-file');

/**
 * Rest upload utilities
 */
export class RestUploadUtil {

  /**
   * Get uploaded file path location
   */
  static getUploadLocation(file: File): string {
    return castTo<{ [RawFileⲐ]: string }>(file)[RawFileⲐ];
  }

  /**
   * Get all the uploads, separating multipart from direct
   */
  static async* getUploads(req: Request, config: Partial<RestUploadConfig>): AsyncIterable<UploadItem> {
    if (MULTIPART.has(req.getContentType()?.full!)) {
      const fileMaxes = Object.values(config.uploads ?? {}).map(x => x.maxSize).filter(x => x !== undefined);
      const largestMax = fileMaxes.length ? Math.max(...fileMaxes) : config.maxSize;
      const itr = new AsyncQueue<UploadItem>();

      // Upload
      req.pipe(busboy({ headers: castTo(req.headers), limits: { fileSize: largestMax } })
        .on('file', (field, stream, filename) => itr.add({ stream, filename, field }))
        .on('limit', field => itr.throw(new AppError(`File size exceeded for ${field}`, { category: 'data' })))
        .on('finish', () => itr.close())
        .on('error', (err) => itr.throw(err instanceof Error ? err : new Error(`${err}`))));

      yield* itr;
    } else {
      yield { stream: req.body ?? req[NodeEntityⲐ], filename: req.getFilename(), field: 'file' };
    }
  }

  /**
   * Convert an UploadItem to a File
   */
  static async toFile({ stream, filename }: UploadItem, config: Partial<RestUploadConfig>): Promise<File> {
    const uniqueDir = path.resolve(os.tmpdir(), `file_${Date.now()}_${Util.uuid(5)}`);
    await fs.mkdir(uniqueDir, { recursive: true });

    filename = filename ? path.basename(filename) : `unknown_${Date.now()}`;

    const location = path.resolve(uniqueDir, filename);
    const remove = (): Promise<void> => fs.rm(location).catch(() => { });
    const mimeCheck = config.matcher ??= MimeUtil.matcher(config.types);

    try {
      const target = createWriteStream(location);

      await (config.maxSize ?
        pipeline(stream, BinaryUtil.limitWrite(config.maxSize), target) :
        pipeline(stream, target));

      const detected = await this.getFileType(location);

      if (!mimeCheck(detected.mime)) {
        throw new AppError(`Content type not allowed: ${detected.mime}`, { category: 'data' });
      }

      if (!path.extname(filename)) {
        filename = `${filename}.${detected.ext}`;
      }

      const file = BinaryUtil.readableBlob(() => createReadStream(location), {
        contentType: detected.mime,
        filename,
        hash: await BinaryUtil.hashInput(createReadStream(location)),
        size: (await fs.stat(location)).size,
      });

      Object.assign(file, { [RawFileⲐ]: location });

      return file;
    } catch (err) {
      await remove();
      throw err;
    }
  }

  /**
   * Get file type
   */
  static async getFileType(input: string | Readable): Promise<FileType> {
    const { default: { fromFile, fromStream } } = await import('file-type');
    const { default: { getType, getExtension } } = await import('mime');

    const matched = await (typeof input === 'string' ? fromFile(input) : fromStream(input));
    if (!matched && typeof input === 'string') {
      const mime = getType(input);
      if (mime) {
        return { ext: getExtension(mime)!, mime };
      }
    }
    return matched ?? { ext: 'bin', mime: 'application/octet-stream' };
  }

  /**
   * Finish upload
   */
  static async finishUpload(upload: File, config: Partial<RestUploadConfig>): Promise<void> {
    if (config.cleanupFiles !== false) {
      await fs.rm(this.getUploadLocation(upload), { force: true });
    }
  }
}