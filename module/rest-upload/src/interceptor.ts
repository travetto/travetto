
import { Inject, Injectable } from '@travetto/di';
import { BodyParseInterceptor, FilterContext, FilterNext, FilterReturn, RestInterceptor, SerializeInterceptor } from '@travetto/rest';

import { RestUploadConfig } from './config';
import { RestUploadUtil } from './util';

const MULTIPART = new Set(['application/x-www-form-urlencoded', 'multipart/form-data',]);

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
      const type = MULTIPART.has(req.getContentType()?.full!) ? 'multipart' : 'direct';
      console.log(`Uploading ${type}`, req.header('content-length'));
      if (type === 'multipart') {
        req.uploads = await RestUploadUtil.uploadMultipart(req, config);
      } else {
        req.uploads = await RestUploadUtil.uploadSingle(req, config);
      };
      return await next();
    } finally {
      for (const item of Object.values(req.uploads ?? {})) {
        if ('cleanup' in item && typeof item.cleanup === 'function') {
          await item.cleanup();
        }
      }
    }
  }
}