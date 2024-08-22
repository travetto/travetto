
import { Inject, Injectable } from '@travetto/di';
import { BodyParseInterceptor, FilterContext, FilterReturn, FilterNext, RestInterceptor, SerializeInterceptor } from '@travetto/rest';
import { BlobUtil } from '@travetto/runtime';

import { RestUploadConfig } from './config';
import { RestUploadUtil } from './util';

@Injectable()
export class RestUploadInterceptor implements RestInterceptor<RestUploadConfig> {

  @Inject()
  config: RestUploadConfig;

  after = [SerializeInterceptor, BodyParseInterceptor];

  /**
   * Produces final config object
   */
  resolveConfig(additional: Partial<RestUploadConfig>[]): RestUploadConfig {
    const out: RestUploadConfig = { ...this.config };
    for (const el of additional) {
      const uploads = out.uploads ?? {};
      for (const [k, cfg] of Object.entries(el.uploads ?? {})) {
        Object.assign(uploads[k] ??= {}, cfg);
      }
      Object.assign(out, el);
      out.uploads = uploads;
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
          req.uploads = await RestUploadUtil.uploadMultipart(req, config);
          break;
        default:
          req.uploads = await RestUploadUtil.uploadDirect(req, config);
          break;
      }
      return await next();
    } finally {
      if (this.config.cleanupFiles !== false && req.uploads) {
        await Promise.all(Object.values(req.uploads).map(x => BlobUtil.cleanupBlob(x)));
      }
    }
  }
}