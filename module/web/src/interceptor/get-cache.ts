import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { HttpChainedContext } from '../types.ts';
import { EndpointConfig } from '../registry/types.ts';

import { HttpInterceptor, HttpInterceptorCategory } from '../types/interceptor.ts';
import { EtagInterceptor } from './etag.ts';
import { HttpResponse } from '../types/response.ts';

@Config('web.getCache')
export class GetCacheConfig {
  /**
   * Generate GET cache headers
   */
  applies = true;
}

/**
 * Determines if we should cache all get requests
 */
@Injectable()
export class GetCacheInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'response';
  dependsOn = [EtagInterceptor];

  @Inject()
  config?: GetCacheConfig;

  applies(endpoint: EndpointConfig, config: GetCacheConfig): boolean {
    return endpoint.method === 'get' && config.applies;
  }

  async filter({ next }: HttpChainedContext): Promise<HttpResponse> {
    const res = await next();
    // Only apply on the way out, and on success
    if (!res.headers.has('Expires') && !res.headers.has('Cache-Control')) {
      res.headers.set('Expires', '-1');
      res.headers.set('Cache-Control', 'max-age=0, no-cache');
    }
    return res;
  }
}