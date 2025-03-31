import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { HttpChainedContext } from '../types.ts';
import { HttpInterceptor } from '../types/interceptor.ts';
import { HttpInterceptorCategory } from '../types/core.ts';
import { HttpResponse } from '../types/response.ts';

import { EndpointConfig } from '../registry/types.ts';
import { EtagInterceptor } from './etag.ts';

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
    return endpoint.method === 'GET' && config.applies;
  }

  async filter({ req, next }: HttpChainedContext): Promise<HttpResponse> {
    if (req.method !== 'GET') {
      return next();
    }

    const res = await next();
    // Only apply on the way out, and on success
    return res.backfillHeaders({ 'Cache-Control': 'max-age=0, no-cache' });
  }
}