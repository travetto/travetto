import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { WebChainedContext } from '../types.ts';
import { WebInterceptor } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebResponse } from '../types/response.ts';

import { EndpointConfig } from '../registry/types.ts';
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
  mode: 'allow' | 'deny' = 'allow';
}

/**
 * Determines if we should cache all get requests
 */
@Injectable()
export class ResponseCacheInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'response';
  dependsOn = [EtagInterceptor];

  @Inject()
  config?: ResponseCacheConfig;

  applies(endpoint: EndpointConfig, config: ResponseCacheConfig): boolean {
    return !!endpoint.cacheable && config.applies && config.mode === 'deny';
  }

  async filter({ req, next }: WebChainedContext): Promise<WebResponse> {
    const res = await next();
    res.headers.setIfAbsent('Cache-Control', 'max-age=0, no-cache');
    return res;
  }
}