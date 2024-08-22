import busboy from '@fastify/busboy';

import { createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';

import { IOUtil } from '@travetto/io';
import { Request, MimeUtil } from '@travetto/rest';
import { NodeEntityⲐ } from '@travetto/rest/src/internal/symbol';
import { BlobUtil, AppError, castTo, Util } from '@travetto/runtime';

import { RestUploadConfig } from './config';

type UploadMap = Record<string, Blob>;

export class RestUploadUtil {

  static async #singleUpload(stream: Readable, filename: string, config: Partial<RestUploadConfig>, field?: string): Promise<Blob> {
    console.log('Doing upload', filename, config, field);

    const uniqueDir = path.resolve(os.tmpdir(), `file_${Date.now()}_${Util.uuid(5)}`);
    await fs.mkdir(uniqueDir, { recursive: true });
    const location = path.resolve(uniqueDir, path.basename(filename));

    try {
      const check = config.matcher ??= MimeUtil.matcher(config.types);
      await IOUtil.streamWithLimit(stream, createWriteStream(location), config.maxSize);
      const blob = await IOUtil.computeMetadata(await BlobUtil.fileBlob(location, { filename }));
      castTo<{ cleanup: Function }>(blob).cleanup = (): Promise<void> => fs.rm(location, { force: true });

      console.log('Got upload', filename, field, blob);

      if (!check(blob.type)) {
        throw new AppError(`Content type not allowed: ${blob.type}`, 'data');
      }
      return blob;
    } catch (err) {
      if (location) {
        await fs.rm(location, { force: true });
      }
      throw err;
    }
  }

  static #getLargestSize(config: Partial<RestUploadConfig>): number | undefined {
    const fileMaxes = [...Object.values(config.uploads ?? {}).map(x => x.maxSize ?? config.maxSize)].filter(x => x !== undefined);
    return fileMaxes.length ? Math.max(...fileMaxes) : config.maxSize;
  }

  static async uploadDirect(req: Request, config: Partial<RestUploadConfig>): Promise<UploadMap> {
    console.log('Starting direct upload', req.header('content-length'));
    try {
      const blob = await this.#singleUpload(req.body ?? req[NodeEntityⲐ], req.getFilename(), config);
      return { file: blob };
    } catch (err) {
      console.error('Failed direct upload', err);
      throw err;
    }
  }

  static async uploadMultipart(req: Request, config: Partial<RestUploadConfig>): Promise<UploadMap> {
    const largestMax = this.#getLargestSize(config);
    const uploads: Promise<Blob>[] = [];
    const uploadMap: UploadMap = {};

    console.log('Starting multipart upload', req.header('content-length'));

    const uploader = busboy({ headers: castTo(req.headers), limits: { fileSize: largestMax } })
      .on('file', (field, stream, filename) =>
        uploads.push(
          this.#singleUpload(stream, filename, { maxSize: largestMax, ...config.uploads![field] ?? config }, field).then(v =>
            uploadMap[field] = v
          )
        )
      )
      .on('limit', field =>
        uploads.push(Promise.reject(new AppError(`File size exceeded for ${field}`, 'data')))
      );

    // Do upload
    let err = await new Promise<Error | undefined>(res => {
      try {
        uploader.on('finish', () => res(undefined)).on('error', res);
        req.pipe(uploader);
      } catch (err2) {
        if (err2 instanceof Error) {
          res(err2);
        } else {
          res(new Error(`${err2}`));
        }
      }
    });

    err ??= (await Promise.allSettled(uploads)).find(x => x.status === 'rejected')?.reason;

    if (err) {
      console.error('Failed multipart upload', err);
      throw err;
    }
    return uploadMap;
  }

  static async cleanupBlobs(blobs: Blob[]): Promise<void> {
    await Promise.all(blobs.map(async blob => {
      if ('cleanup' in blob && typeof blob.cleanup === 'function') {
        await blob.cleanup();
      }
    }));
  }
}