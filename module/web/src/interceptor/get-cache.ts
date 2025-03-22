import { Injectable, Inject } from '@travetto/di';

import { HttpContext } from '../types.ts';
import { EndpointConfig } from '../registry/types.ts';

import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';
import { Config } from '@travetto/config';

@Config('web.getCache')
export class GetCacheConfig {
  /**
   * Should this be turned off by default?
   */
  disabled?: boolean;
}

/**
 * Determines if we should cache all get requests
 */
@Injectable()
export class GetCacheInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'response';

  @Inject()
  config?: GetCacheConfig;

  applies(endpoint: EndpointConfig): boolean {
    return endpoint.method === 'get';
  }

  async intercept({ res, next }: HttpContext): Promise<unknown> {
    const result = await next();
    // Only apply on the way out, and on success
    if (res.getHeader('Expires') === undefined && res.getHeader('Cache-Control') === undefined) {
      res.setHeader('Expires', '-1');
      res.setHeader('Cache-Control', 'max-age=0, no-cache');
    }
    return result;
  }
}