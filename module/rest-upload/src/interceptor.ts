import { Inject, Injectable } from '@travetto/di';
import { BodyParseInterceptor, FilterContext, FilterNext, FilterReturn, RestInterceptor, SerializeInterceptor } from '@travetto/rest';

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
      req.uploads = {};

      for await (const item of RestUploadUtil.getUploads(req, config)) {
        req.uploads[item.field] = await RestUploadUtil.toFile(item, config.uploads?.[item.field] ?? config);
      }

      return await next();
    } finally {
      for (const [field, item] of Object.entries(req.uploads)) {
        await RestUploadUtil.finishUpload(item, config.uploads?.[field] ?? config);
      }
    }
  }
}