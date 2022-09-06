import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { RouteConfig, Request, Response } from '../types';

import { RestInterceptor, DisabledConfig, PathAwareConfig } from './types';
import { CorsInterceptor } from './cors';
import { ConfiguredInterceptor } from './decorator';

@Config('rest.getCache')
class RestGetCacheConfig implements DisabledConfig, PathAwareConfig {
  /**
   * Is interceptor disabled
   */
  disabled = false;
  /**
   * Path specific overrides
   */
  paths: string[] = [];
}

/**
 * Determines if we should cache all get requests
 */
@Injectable()
@ConfiguredInterceptor()
export class GetCacheInterceptor implements RestInterceptor {

  after = [CorsInterceptor];

  @Inject()
  config: RestGetCacheConfig;

  applies(route: RouteConfig): boolean {
    return route.method === 'get';
  }

  async intercept(req: Request, res: Response, next: () => Promise<void | unknown>): Promise<unknown> {
    const result = await next();
    // Only apply on the way out, and on success
    if (res.getHeader('Expires') === undefined && res.getHeader('Cache-Control') === undefined) {
      res.setHeader('Expires', '-1');
      res.setHeader('Cache-Control', 'max-age=0, no-cache');
    }
    return result;
  }
}