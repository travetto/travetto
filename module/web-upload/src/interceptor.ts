import { Inject, Injectable } from '@travetto/di';
import {
  BodyInterceptor, WebInterceptor, WebInterceptorCategory, WebChainedContext,
  WebResponse, DecompressInterceptor, WebInterceptorContext
} from '@travetto/web';

import { WebUploadConfig } from './config.ts';
import { WebUploadUtil } from './util.ts';
import { FileMap } from './types.ts';

@Injectable()
export class WebUploadInterceptor implements WebInterceptor<WebUploadConfig> {

  category: WebInterceptorCategory = 'request';
  runsBefore = [BodyInterceptor];
  dependsOn = [DecompressInterceptor];

  @Inject()
  config: WebUploadConfig;

  /**
   * Produces final config object
   */
  finalizeConfig({ config: base }: WebInterceptorContext<WebUploadConfig>, inputs: Partial<WebUploadConfig>[]): WebUploadConfig {
    base.uploads ??= {};
    // Override the uploads object with all the data from the inputs
    for (const [key, config] of inputs.flatMap(inputConfig => Object.entries(inputConfig.uploads ?? {}))) {
      Object.assign(base.uploads[key] ??= {}, config);
    }
    return base;
  }

  applies({ config }: WebInterceptorContext<WebUploadConfig>): boolean {
    return config.applies;
  }

  async filter({ request, config, next }: WebChainedContext<WebUploadConfig>): Promise<WebResponse> {
    const uploads: FileMap = {};

    try {
      for await (const item of WebUploadUtil.getUploads(request, config)) {
        uploads[item.field] = await WebUploadUtil.toFile(item, config.uploads?.[item.field] ?? config);
      }

      WebUploadUtil.setRequestUploads(request, uploads);

      return await next();
    } finally {
      for (const [field, item] of Object.entries(uploads)) {
        await WebUploadUtil.finishUpload(item, config.uploads?.[field] ?? config);
      }
    }
  }
}