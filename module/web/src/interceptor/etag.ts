import crypto from 'node:crypto';
import fresh from 'fresh';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { HttpChainedContext, HttpContext } from '../types.ts';
import { HttpResponse } from '../types/response.ts';
import { HttpInterceptor } from '../types/interceptor.ts';
import { HttpInterceptorCategory } from '../types/core.ts';
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

  addTag(ctx: HttpContext, res: HttpResponse): HttpResponse {
    const { req } = ctx;

    if (
      Buffer.isBuffer(res.output) &&
      (
        !res.statusCode ||
        (res.statusCode < 300 && res.statusCode >= 200) ||
        res.statusCode === 304
      )
    ) {

      const tag = res.output.length === 0 ?
        '2jmj7l5rSw0yVb/vlWAYkK/YBwk' :
        crypto
          .createHash('sha1')
          .update(res.output.toString('utf8'), 'utf8')
          .digest('base64')
          .substring(0, 27);

      res.headers.set('ETag', `${this.config.weak ? 'W/' : ''}"${tag}"`);

      const lastModified = res.headers.get('Last-Modified');

      if (
        (req.method === 'GET' || req.method === 'HEAD') &&
        fresh({
          'if-modified-since': req.headers.get('If-Modified-Since')!,
          'if-none-match': req.headers.get('If-None-Match')!,
          'cache-control': req.headers.get('Cache-Control')!,
        }, { etag: tag, 'last-modified': lastModified! })
      ) {
        return HttpResponse.fromEmpty().with({ statusCode: 304 });
      }
    }

    return res;
  }

  applies(ep: EndpointConfig, config: EtagConfig): boolean {
    return config.applies;
  }

  async filter(ctx: HttpChainedContext): Promise<HttpResponse> {
    return this.addTag(ctx, await ctx.next());
  }
}