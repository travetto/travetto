import busboy, { type BusboyHeaders } from '@fastify/busboy';

import { Inject, Injectable } from '@travetto/di';
import {
  BodyParseInterceptor, FilterContext, FilterReturn, FilterNext, Request,
  RestInterceptor, SerializeInterceptor, MimeUtil
} from '@travetto/rest';
import { NodeEntityⲐ } from '@travetto/rest/src/internal/symbol';
import { AppError } from '@travetto/base';

import { RestUploadConfig } from './config';
import { RestUploadUtil } from './util';
import { LocalFile } from './file';

type FileMap = Record<string, File>;

@Injectable()
export class RestAssetInterceptor implements RestInterceptor<RestUploadConfig> {

  static getLargestFileMax(config: Partial<RestUploadConfig>): number | undefined {
    const fileMaxes = [...Object.values(config.files!).map(x => x.maxSize ?? config.maxSize)].filter(x => x !== undefined);
    return fileMaxes.length ? Math.max(...fileMaxes) : config.maxSize;
  }

  static async validateFile(config: Partial<RestUploadConfig>, file: LocalFile): Promise<LocalFile> {
    const check = config.matcher ??= MimeUtil.matcher(config.types);
    if (check(file.type)) {
      return file;
    } else {
      await file.cleanup();
      throw new AppError(`Content type not allowed: ${file.type}`, 'data');
    }
  }

  static async uploadDirect(req: Request, config: Partial<RestUploadConfig>): Promise<FileMap> {
    console.log('Starting direct upload', req.header('content-length'));
    const filename = req.getFilename();
    const file = await RestUploadUtil.convertToBlob(req.body ?? req[NodeEntityⲐ], filename, config.maxSize);
    try {
      return { file: await this.validateFile(config, file) };
    } catch (err) {
      console.error('Failed direct upload', err);
      throw err;
    }
  }

  static async uploadMultipart(req: Request, config: Partial<RestUploadConfig>): Promise<FileMap> {
    const largestMax = this.getLargestFileMax(config);
    const uploads: Promise<LocalFile>[] = [];
    const files: FileMap = {};

    console.log('Starting multipart upload', req.header('content-length'));

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const uploader = busboy({ headers: req.headers as BusboyHeaders, limits: { fileSize: largestMax } })
      .on('file', (field, stream, filename) =>
        uploads.push(
          RestUploadUtil.convertToBlob(stream, filename, config.files![field]?.maxSize ?? largestMax)
            .then(file => files[field] = file)
            .then(file => this.validateFile(config.files?.[field] ?? config, file))
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
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        res(err2 as Error);
      }
    });

    err ??= (await Promise.allSettled(uploads)).find(x => x.status === 'rejected')?.reason;

    if (err) {
      console.error('Failed multipart upload', err);
      await RestUploadUtil.cleanupFiles(files);
      throw err;
    }
    return files;
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
      const files = out.files ?? {};
      for (const [k, file] of Object.entries(el.files ?? {})) {
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
          req.files = await RestAssetInterceptor.uploadMultipart(req, config);
          break;
        default:
          req.files = await RestAssetInterceptor.uploadDirect(req, config);
          break;
      }
      return await next();
    } finally {
      if (config.deleteFiles !== false) {
        await RestUploadUtil.cleanupFiles(req.files);
      }
    }
  }
}