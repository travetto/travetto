import { Inject, Injectable } from '@travetto/di';
import {
  BodyParseInterceptor, WebInterceptor, WebInterceptorCategory, WebChainedContext,
  EndpointConfig, WebResponse, WebInternalSymbol,
  CompressInterceptor
} from '@travetto/web';

import { WebUploadConfig } from './config.ts';
import { WebUploadUtil } from './util.ts';
import { FileMap } from './types.ts';
import { DecompressInterceptor } from '@travetto/web/src/interceptor/decompress.ts';

@Injectable()
export class WebUploadInterceptor implements WebInterceptor<WebUploadConfig> {

  category: WebInterceptorCategory = 'request';
  runsBefore = [BodyParseInterceptor];
  dependsOn = [DecompressInterceptor];

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

  applies(ep: EndpointConfig, config: WebUploadConfig): boolean {
    return config.applies;
  }

  async filter({ req, config, next }: WebChainedContext<WebUploadConfig>): Promise<WebResponse> {
    const uploads: FileMap = {};

    try {
      for await (const item of WebUploadUtil.getUploads(req, config)) {
        uploads[item.field] = await WebUploadUtil.toFile(item, config.uploads?.[item.field] ?? config);
      }

      req[WebInternalSymbol].uploads = uploads;

      return await next();
    } finally {
      for (const [field, item] of Object.entries(uploads)) {
        await WebUploadUtil.finishUpload(item, config.uploads?.[field] ?? config);
      }
    }
  }
}