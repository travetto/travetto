import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { WebChainedContext } from '../types/filter.ts';
import { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebResponse } from '../types/response.ts';
import { WebCommonUtil } from '../util/common.ts';

import { EtagInterceptor } from './etag.ts';

@Config('web.cache')
export class ResponseCacheConfig {
  /**
   * Generate response cache headers
   */
  applies = true;
}

/**
 * Determines if we should cache all get requests
 */
@Injectable()
export class ResponseCacheInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'response';
  dependsOn = [EtagInterceptor];

  @Inject()
  config: ResponseCacheConfig;

  applies({ config, endpoint }: WebInterceptorContext<ResponseCacheConfig>): boolean {
    return config.applies &&
      endpoint.cacheable &&
      !endpoint.finalizedResponseHeaders.has('Cache-Control') &&
      (endpoint.responseContext?.cacheableAge ?? 1) > 0;
  }

  async filter({ next }: WebChainedContext<ResponseCacheConfig>): Promise<WebResponse> {
    const response = await next();
    if (!response.headers.has('Cache-Control')) {
      response.headers.set('Cache-Control', WebCommonUtil.getCacheControlValue(
        response.context.cacheableAge ?? 0,
        [
          response.context.isPrivate ? 'private' : 'public',
        ]
      ));
    }
    return response;
  }
}