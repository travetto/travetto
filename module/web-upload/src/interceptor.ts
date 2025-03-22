import { Inject, Injectable } from '@travetto/di';
import { BodyParseInterceptor, HttpInterceptor, WebInternal, HttpInterceptorCategory, HttpChainedContext } from '@travetto/web';

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
  finalizeConfig(base: WebUploadConfig, inputs: Partial<WebUploadConfig>[]): WebUploadConfig {
    base.uploads ??= {};
    // Override the uploads object with all the data from the inputs
    for (const [k, cfg] of inputs.flatMap(el => Object.entries(el.uploads ?? {}))) {
      Object.assign(base.uploads[k] ??= {}, cfg);
    }
    return base;
  }

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  async filter({ req, config, next }: HttpChainedContext<WebUploadConfig>): Promise<unknown> {
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