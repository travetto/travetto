import busboy from '@fastify/busboy';

import { Readable } from 'node:stream';

import { IOUtil } from '@travetto/io';
import { Request, MimeUtil } from '@travetto/rest';
import { NodeEntityⲐ } from '@travetto/rest/src/internal/symbol';
import { BlobUtil, AppError, castTo } from '@travetto/runtime';

import { RestUploadConfig } from './config';

type UploadMap = Record<string, Blob>;

export class RestUploadUtil {
  static #singleUpload(stream: Readable, filename: string, config: Partial<RestUploadConfig>): Promise<Blob> {
    return IOUtil.writeTempFile(stream, filename, config.maxSize)
      .then(location => BlobUtil.fileBlob(location))
      .then(blob => IOUtil.computeMetadata(blob))
      .then(async blob => {
        const check = config.matcher ??= MimeUtil.matcher(config.types);
        if (check(blob.type)) {
          return blob;
        } else {
          await BlobUtil.cleanupBlob(blob);
          throw new AppError(`Content type not allowed: ${blob.type}`, 'data');
        }
      });
  }

  static #getLargestSize(config: Partial<RestUploadConfig>): number | undefined {
    const fileMaxes = [...Object.values(config.uploads!).map(x => x.maxSize ?? config.maxSize)].filter(x => x !== undefined);
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
          this.#singleUpload(stream, filename, { maxSize: largestMax, ...config.uploads![field] ?? config })
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
}