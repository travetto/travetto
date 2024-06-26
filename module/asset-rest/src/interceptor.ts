import busboy, { type BusboyHeaders } from '@fastify/busboy';

import { Asset } from '@travetto/asset';
import { Inject, Injectable } from '@travetto/di';
import {
  BodyParseInterceptor, FilterContext, FilterReturn, FilterNext, Request,
  RestInterceptor, SerializeInterceptor, MimeUtil
} from '@travetto/rest';
import { NodeEntityⲐ } from '@travetto/rest/src/internal/symbol';
import { AppError } from '@travetto/base';

import { RestAssetConfig } from './config';
import { AssetRestUtil, WithCleanup } from './util';

type AssetMap = Record<string, Asset>;

@Injectable()
export class RestAssetInterceptor implements RestInterceptor<RestAssetConfig> {

  static getLargestFileMax(config: Partial<RestAssetConfig>): number | undefined {
    const fileMaxes = [...Object.values(config.files!).map(x => x.maxSize ?? config.maxSize)].filter(x => x !== undefined);
    return fileMaxes.length ? Math.max(...fileMaxes) : config.maxSize;
  }

  static async validateAsset(config: Partial<RestAssetConfig>, asset: Asset): Promise<Asset> {
    const check = config.matcher ??= MimeUtil.matcher(config.types);
    if (check(asset.contentType)) {
      return asset;
    } else {
      throw new AppError(`Content type not allowed: ${asset.contentType}`, 'data');
    }
  }

  static async uploadDirect(req: Request, config: Partial<RestAssetConfig>): Promise<WithCleanup<AssetMap>> {
    console.log('Starting direct upload', req.header('content-length'));
    const filename = AssetRestUtil.getFileName(req);
    const [asset, cleanup] = await AssetRestUtil.writeToAsset(req.body ?? req[NodeEntityⲐ], filename, config.maxSize);
    try {
      return [{ file: await this.validateAsset(config, asset) }, config.deleteFiles !== false ? cleanup : (async (): Promise<void> => { })];
    } catch (err) {
      console.error('Failed direct upload', err);
      await cleanup();
      throw err;
    }
  }

  static async uploadMultipart(req: Request, config: Partial<RestAssetConfig>): Promise<WithCleanup<AssetMap>> {
    const largestMax = this.getLargestFileMax(config);
    const uploads: Promise<unknown>[] = [];
    const files: AssetMap = {};

    const allCleanups: Function[] = [];
    const managedCleanups: Function[] = [];

    console.log('Starting multipart upload', req.header('content-length'));

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const uploader = busboy({ headers: req.headers as BusboyHeaders, limits: { fileSize: largestMax } })
      .on('file', (field, stream, filename) =>
        uploads.push(
          AssetRestUtil.writeToAsset(stream, filename, config.files![field]?.maxSize ?? largestMax)
            .then(([asset, cleanup]) => {
              if (config.deleteFiles !== false) {
                managedCleanups.push(cleanup);
              }
              allCleanups.push(cleanup);
              return files[field] = asset;
            })
            .then(asset => this.validateAsset(config.files?.[field] ?? config, asset))
        )
      )
      .on('limit', field =>
        uploads.push(Promise.reject(new AppError(`File size exceeded for ${field}`, 'data')))
      );

    try {
      // Do upload
      await new Promise<unknown>((res, rej) => {
        try {
          uploader.on('finish', res).on('error', rej);
          req.pipe(uploader);
        } catch (err) {
          rej(err);
        }
      });

      // Finish files
      await Promise.all(uploads);
    } catch (err) {
      console.error('Failed multipart upload', err);
      await Promise.all(allCleanups.map(x => x()));
      throw err;
    }
    return [files, async (): Promise<void> => { await Promise.all(managedCleanups.map(x => x())); }];
  }

  @Inject()
  config: RestAssetConfig;

  after = [SerializeInterceptor, BodyParseInterceptor];

  /**
   * Produces final config object
   */
  resolveConfig(additional: Partial<RestAssetConfig>[]): RestAssetConfig {
    const out: RestAssetConfig = { ...this.config };
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

  async intercept({ req, config }: FilterContext<RestAssetConfig>, next: FilterNext): Promise<FilterReturn> {
    let cleanup: (() => Promise<void>) | undefined;
    try {
      switch (req.getContentType()?.full) {
        case 'application/x-www-form-urlencoded':
        case 'multipart/form-data':
          [req.files, cleanup] = await RestAssetInterceptor.uploadMultipart(req, config);
          break;
        default:
          [req.files, cleanup] = await RestAssetInterceptor.uploadDirect(req, config);
          break;
      }
      return await next();
    } finally {
      if (cleanup) {
        await cleanup();
      }
    }
  }
}