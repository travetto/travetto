import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { RouteConfig, FilterContext, FilterNext } from '../types';

import { ManagedInterceptorConfig, HttpInterceptor } from './types';
import { SerializeInterceptor } from './serialize';

@Config('web.getCache')
export class WebGetCacheConfig extends ManagedInterceptorConfig { }

/**
 * Determines if we should cache all get requests
 */
@Injectable()
export class GetCacheInterceptor implements HttpInterceptor {

  dependsOn = [SerializeInterceptor];

  @Inject()
  config: WebGetCacheConfig;

  applies(route: RouteConfig): boolean {
    return route.method === 'get';
  }

  async intercept({ res }: FilterContext, next: FilterNext): Promise<unknown> {
    const result = await next();
    // Only apply on the way out, and on success
    if (res.getHeader('Expires') === undefined && res.getHeader('Cache-Control') === undefined) {
      res.setHeader('Expires', '-1');
      res.setHeader('Cache-Control', 'max-age=0, no-cache');
    }
    return result;
  }
}