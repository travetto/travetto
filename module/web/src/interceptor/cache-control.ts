import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { WebChainedContext } from '../types/filter.ts';
import { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebResponse } from '../types/response.ts';

import { EtagInterceptor } from './etag.ts';

@Config('web.cache')
export class CacheControlConfig {
  /**
   * Generate response cache headers
   */
  applies = true;
}

/**
 * Determines if we should cache all get requests
 */
@Injectable()
export class CacheControlInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'response';
  dependsOn = [EtagInterceptor];

  @Inject()
  config: CacheControlConfig;

  applies({ config, endpoint }: WebInterceptorContext<CacheControlConfig>): boolean {
    return config.applies && endpoint.cacheable;
  }

  async filter({ next }: WebChainedContext<CacheControlConfig>): Promise<WebResponse> {
    const response = await next();
    if (!response.headers.has('Cache-Control')) {
      const parts: string[] = [];
      if (response.context.isPrivate !== undefined) {
        parts.push(response.context.isPrivate ? 'private' : 'public');
      }
      if (response.context.cacheableAge !== undefined) {
        parts.push(
          ...(response.context.cacheableAge <= 0 ?
            ['no-store', 'max-age=0'] :
            [`max-age=${response.context.cacheableAge}`]
          )
        );
      } else if (response.context.isPrivate) { // If private, but no age, don't store
        parts.push('no-store');
      }
      if (parts.length) {
        response.headers.set('Cache-Control', parts.join(','));
      }
    }
    return response;
  }
}