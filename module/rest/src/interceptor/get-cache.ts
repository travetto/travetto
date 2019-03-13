import { Injectable, Inject } from '@travetto/di';

import { RouteConfig, Request, Response } from '../types';
import { RestConfig } from '../config';
import { RestInterceptor } from './types';
import { CorsInterceptor } from './cors';

@Injectable()
export class GetCacheInterceptor extends RestInterceptor {

  after = CorsInterceptor;

  @Inject()
  config: RestConfig;

  applies(route: RouteConfig) {
    return route.method === 'get' && this.config.disableGetCache;
  }

  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    const result = await next();
    // Only apply on the way out, and on success
    if (!res.getHeader('Expires') && !res.getHeader('Cache-Control')) {
      res.setHeader('Expires', '-1');
      res.setHeader('Cache-Control', 'max-age=0, no-cache');
    }
    return result;
  }
}