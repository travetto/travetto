import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { WebChainedContext } from '../types.ts';
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

  /**
   * Determines how we cache
   */
  mode: 'allow' | 'deny' = 'deny';
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
    return !!endpoint.cacheable && config.applies && config.mode === 'deny';
  }

  async filter({ next }: WebChainedContext<ResponseCacheConfig>): Promise<WebResponse> {
    const response = await next();
    response.headers.setIfAbsent('Cache-Control', WebCommonUtil.getCacheControlValue(0));
    return response;
  }
}