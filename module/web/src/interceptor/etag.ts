import crypto from 'node:crypto';
import fresh from 'fresh';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { HttpChainedContext, HttpContext } from '../types.ts';
import { HttpResponse } from '../types/response.ts';
import { HttpInterceptor, HttpInterceptorCategory } from '../types/interceptor.ts';
import { CompressionInterceptor } from './compress.ts';
import { EndpointConfig } from '../registry/types.ts';

@Config('web.etag')
export class EtagConfig {
  /**
   * Attempt ETag generation
   */
  applies = true;
  /**
   * Should we generate a weak etag
   */
  weak?: boolean;
}

/**
 * Enables etag support
 */
@Injectable()
export class EtagInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'response';
  dependsOn = [CompressionInterceptor];

  @Inject()
  config: EtagConfig;

  addTag(ctx: HttpContext, payload: HttpResponse): HttpResponse {
    const { req } = ctx;

    if (
      Buffer.isBuffer(payload.output) &&
      (
        !payload.statusCode ||
        (payload.statusCode < 300 && payload.statusCode >= 200) ||
        payload.statusCode === 304
      )
    ) {

      const tag = payload.output.length === 0 ?
        '2jmj7l5rSw0yVb/vlWAYkK/YBwk' :
        crypto
          .createHash('sha1')
          .update(payload.output.toString('utf8'), 'utf8')
          .digest('base64')
          .substring(0, 27);

      payload.headers.set('ETag', `${this.config.weak ? 'W/' : ''}"${tag}"`);

      const lastModified = payload.headers.get('Last-Modified');

      if (
        (req.method === 'GET' || req.method === 'HEAD') &&
        fresh(req.headers.toObject(), { etag: tag, 'last-modified': lastModified })
      ) {
        return HttpResponse.fromEmpty().with({ statusCode: 304 });
      }
    }

    return payload;
  }

  applies(ep: EndpointConfig, config: EtagConfig): boolean {
    return config.applies;
  }

  async filter(ctx: HttpChainedContext): Promise<HttpResponse> {
    return this.addTag(ctx, await ctx.next());
  }
}