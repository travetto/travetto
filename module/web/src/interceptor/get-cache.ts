import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { HttpChainedContext } from '../types.ts';
import { EndpointConfig } from '../registry/types.ts';

import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';
import { EtagInterceptor } from './etag.ts';
import { HttpPayload } from '../response/payload.ts';

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

  async filter({ next }: HttpChainedContext): Promise<HttpPayload> {
    const payload = await next();
    // Only apply on the way out, and on success
    if (!payload.hasHeader('Expires') && !payload.hasHeader('Cache-Control')) {
      payload.setHeader('Expires', '-1');
      payload.setHeader('Cache-Control', 'max-age=0, no-cache');
    }
    return payload;
  }
}