import { Inject, Injectable } from '@travetto/di';
import { BodyParseInterceptor, FilterContext, FilterNext, FilterReturn, HttpInterceptor } from '@travetto/web';

import { WebUploadConfig } from './config';
import { WebUploadUtil } from './util';
import { FileMap, WebUploadSymbol } from './types';

@Injectable()
export class WebUploadInterceptor implements HttpInterceptor<WebUploadConfig> {

  @Inject()
  config: WebUploadConfig;

  dependsOn = [BodyParseInterceptor];

  /**
   * Produces final config object
   */
  resolveConfig(additional: Partial<WebUploadConfig>[]): WebUploadConfig {
    const out: WebUploadConfig = { ...this.config };
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

  async intercept({ req, config }: FilterContext<WebUploadConfig>, next: FilterNext): Promise<FilterReturn> {
    const uploads: FileMap = {};

    try {
      for await (const item of WebUploadUtil.getUploads(req, config)) {
        uploads[item.field] = await WebUploadUtil.toFile(item, config.uploads?.[item.field] ?? config);
      }

      req[WebUploadSymbol] = uploads;

      return await next();
    } finally {
      for (const [field, item] of Object.entries(uploads)) {
        await WebUploadUtil.finishUpload(item, config.uploads?.[field] ?? config);
      }
    }
  }
}