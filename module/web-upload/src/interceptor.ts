import { Inject, Injectable } from '@travetto/di';
import { BodyParseInterceptor, HttpContext, HttpInterceptor, WebInternal, HttpInterceptorCategory } from '@travetto/web';

import { WebUploadConfig } from './config.ts';
import { WebUploadUtil } from './util.ts';
import { FileMap } from './types.ts';

@Injectable()
export class WebUploadInterceptor implements HttpInterceptor<WebUploadConfig> {

  category: HttpInterceptorCategory = 'request';
  dependsOn = [BodyParseInterceptor];

  @Inject()
  config: WebUploadConfig;

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

  async filter({ req, config, next }: HttpContext<WebUploadConfig>): Promise<unknown> {
    const uploads: FileMap = {};

    try {
      for await (const item of WebUploadUtil.getUploads(req, config)) {
        uploads[item.field] = await WebUploadUtil.toFile(item, config.uploads?.[item.field] ?? config);
      }

      req[WebInternal].uploads = uploads;

      return await next();
    } finally {
      for (const [field, item] of Object.entries(uploads)) {
        await WebUploadUtil.finishUpload(item, config.uploads?.[field] ?? config);
      }
    }
  }
}