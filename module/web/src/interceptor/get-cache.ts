import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { HttpContext, WebFilterNext } from '../types.ts';
import { EndpointConfig } from '../registry/types.ts';

import { ManagedInterceptorConfig, HttpInterceptor, HttpInterceptorCategory } from './types.ts';

@Config('web.getCache')
export class GetCacheConfig extends ManagedInterceptorConfig { }

/**
 * Determines if we should cache all get requests
 */
@Injectable()
export class GetCacheInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'response';

  @Inject()
  config: GetCacheConfig;

  applies(endpoint: EndpointConfig): boolean {
    return endpoint.method === 'get';
  }

  async intercept({ res }: HttpContext, next: WebFilterNext): Promise<unknown> {
    const result = await next();
    // Only apply on the way out, and on success
    if (res.getHeader('Expires') === undefined && res.getHeader('Cache-Control') === undefined) {
      res.setHeader('Expires', '-1');
      res.setHeader('Cache-Control', 'max-age=0, no-cache');
    }
    return result;
  }
}