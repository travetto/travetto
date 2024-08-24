import busboy from '@fastify/busboy';

import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { IOUtil } from '@travetto/io';
import { Request, MimeUtil } from '@travetto/rest';
import { NodeEntityⲐ } from '@travetto/rest/src/internal/symbol';
import { BlobUtil, AppError, castTo, Util, TypedObject } from '@travetto/runtime';

import { RestUploadConfig } from './config';
import { UploadMap } from './types';

/**
 * Rest upload utilities
 */
export class RestUploadUtil {

  static async #uploadSingle(stream: Readable, filename: string, config: Partial<RestUploadConfig>): Promise<Blob> {
    const uniqueDir = path.resolve(os.tmpdir(), `file_${Date.now()}_${Util.uuid(5)}`);
    await fs.mkdir(uniqueDir, { recursive: true });
    filename = path.basename(filename);

    const location = path.resolve(uniqueDir, filename);
    const remove = (): Promise<void> => fs.rm(location).catch(() => { });

    try {
      await IOUtil.streamWithLimit(stream, createWriteStream(location), config.maxSize);
      const contentType = (await IOUtil.detectType(location)).mime;

      if (!path.extname(filename)) {
        filename = `${filename}.${IOUtil.getExtension(contentType)}`;
      }

      const blob = BlobUtil.readableBlob(() => createReadStream(location), {
        contentType,
        filename,
        hash: await IOUtil.hashInput(createReadStream(location)),
        size: (await fs.stat(location)).size,
      });

      if (config.cleanupFiles !== false) {
        castTo<{ cleanup: Function }>(blob).cleanup = remove;
      }

      const check = config.matcher ??= MimeUtil.matcher(config.types);
      if (!check(blob.type)) {
        throw new AppError(`Content type not allowed: ${blob.type}`, 'data');
      }
      return blob;
    } catch (err) {
      await remove();
      throw err;
    }
  }

  static async uploadSingle(req: Request, config: Partial<RestUploadConfig>): Promise<UploadMap> {
    return { file: await this.#uploadSingle(req.body ?? req[NodeEntityⲐ], req.getFilename(), config) };
  }

  static async uploadMultipart(req: Request, config: Partial<RestUploadConfig>): Promise<UploadMap> {
    const fileMaxes = [...Object.values(config.uploads ?? {}).map(x => x.maxSize ?? config.maxSize)].filter(x => x !== undefined);
    const largestMax = fileMaxes.length ? Math.max(...fileMaxes) : config.maxSize;
    const uploads: Promise<[string, Blob]>[] = [];

    const uploader = busboy({ headers: castTo(req.headers), limits: { fileSize: largestMax } })
      .on('file', (field, stream, filename) =>
        uploads.push(
          this.#uploadSingle(stream, filename, { ...config.uploads![field] ?? config })
            .then(v => [field, v])
        )
      )
      .on('limit', field =>
        uploads.push(Promise.reject(new AppError(`File size exceeded for ${field}`, 'data')))
      );

    // Do upload
    await pipeline(req.stream(), uploader);
    return TypedObject.fromEntries(await Promise.all(uploads));
  }

  static async cleanup(req: Request): Promise<void> {
    for (const item of Object.values(req.uploads ?? {})) {
      if ('cleanup' in item && typeof item.cleanup === 'function') {
        await item.cleanup();
      }
    }
  }
}