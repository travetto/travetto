import busboy from '@fastify/busboy';

import { Inject, Injectable } from '@travetto/di';
import {
  BodyParseInterceptor, FilterContext, FilterReturn, FilterNext, Request,
  RestInterceptor, SerializeInterceptor, MimeUtil
} from '@travetto/rest';
import { NodeEntityⲐ } from '@travetto/rest/src/internal/symbol';
import { AppError, castTo } from '@travetto/runtime';
import { BlobUtil } from '@travetto/io';

import { RestUploadConfig } from './config';
import { RestUploadUtil } from './util';

type UploadMap = Record<string, Blob>;

@Injectable()
export class RestAssetInterceptor implements RestInterceptor<RestUploadConfig> {

  static getLargestSize(config: Partial<RestUploadConfig>): number | undefined {
    const fileMaxes = [...Object.values(config.uploads!).map(x => x.maxSize ?? config.maxSize)].filter(x => x !== undefined);
    return fileMaxes.length ? Math.max(...fileMaxes) : config.maxSize;
  }

  static async validateUpload(config: Partial<RestUploadConfig>, upload: Blob): Promise<Blob> {
    const check = config.matcher ??= MimeUtil.matcher(config.types);
    if (check(upload.type)) {
      return upload;
    } else {
      await BlobUtil.cleanupBlob(upload);
      throw new AppError(`Content type not allowed: ${upload.type}`, 'data');
    }
  }

  static async uploadDirect(req: Request, config: Partial<RestUploadConfig>): Promise<UploadMap> {
    console.log('Starting direct upload', req.header('content-length'));
    const filename = req.getFilename();
    const location = await RestUploadUtil.writeToFile(req.body ?? req[NodeEntityⲐ], filename, config.maxSize);
    const blob = await BlobUtil.fileBlob(location);
    try {
      return { file: await this.validateUpload(config, blob) };
    } catch (err) {
      console.error('Failed direct upload', err);
      throw err;
    }
  }

  static async uploadMultipart(req: Request, config: Partial<RestUploadConfig>): Promise<UploadMap> {
    const largestMax = this.getLargestSize(config);
    const uploads: Promise<Blob>[] = [];
    const uploadMap: UploadMap = {};

    console.log('Starting multipart upload', req.header('content-length'));

    const uploader = busboy({ headers: castTo(req.headers), limits: { fileSize: largestMax } })
      .on('file', (field, stream, filename) =>
        uploads.push(
          RestUploadUtil.writeToFile(stream, filename, config.uploads![field]?.maxSize ?? largestMax)
            .then(location => BlobUtil.fileBlob(location))
            .then(blob => uploadMap[field] = blob)
            .then(blob => this.validateUpload(config.uploads?.[field] ?? config, blob))
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
      await RestUploadUtil.cleanupFiles(uploadMap);
      throw err;
    }
    return uploadMap;
  }

  @Inject()
  config: RestUploadConfig;

  after = [SerializeInterceptor, BodyParseInterceptor];

  /**
   * Produces final config object
   */
  resolveConfig(additional: Partial<RestUploadConfig>[]): RestUploadConfig {
    const out: RestUploadConfig = { ...this.config };
    for (const el of additional) {
      const files = out.uploads ?? {};
      for (const [k, file] of Object.entries(el.uploads ?? {})) {
        Object.assign(files[k] ??= {}, file);
      }
      Object.assign(out, el, { files });
    }
    return out;
  }

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  async intercept({ req, config }: FilterContext<RestUploadConfig>, next: FilterNext): Promise<FilterReturn> {
    try {
      switch (req.getContentType()?.full) {
        case 'application/x-www-form-urlencoded':
        case 'multipart/form-data':
          req.uploads = await RestAssetInterceptor.uploadMultipart(req, config);
          break;
        default:
          req.uploads = await RestAssetInterceptor.uploadDirect(req, config);
          break;
      }
      return await next();
    } finally {
      if (config.cleanupFiles !== false) {
        await RestUploadUtil.cleanupFiles(req.uploads);
      }
    }
  }
}