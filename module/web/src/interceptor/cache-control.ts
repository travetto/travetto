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
      const parts: string[] = [response.context.isPrivate ? 'private' : 'public'];
      const age = response.context.cacheableAge ?? (response.context.isPrivate ? 0 : undefined);
      if (age !== undefined) {
        if (age <= 0) {
          parts.push('no-store');
        }
        parts.push(`max-age=${Math.max(age, 0)}`);
      }
      response.headers.set('Cache-Control', parts.join(','));
    }
    return response;
  }
}