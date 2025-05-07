import crypto from 'node:crypto';
import fresh from 'fresh';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';
import { BinaryUtil, castTo } from '@travetto/runtime';

import { WebChainedContext } from '../types/filter.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { CompressInterceptor } from './compress.ts';
import { WebBodyUtil } from '../util/body.ts';

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

  @Ignore()
  cacheable?: boolean;
}

/**
 * Enables etag support
 */
@Injectable()
export class EtagInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'response';
  dependsOn = [CompressInterceptor];

  @Inject()
  config: EtagConfig;

  computeTag(body: Buffer): string {
    return body.byteLength === 0 ?
      '2jmj7l5rSw0yVb/vlWAYkK/YBwk' :
      crypto
        .createHash('sha1')
        .update(body.toString('utf8'), 'utf8')
        .digest('base64')
        .substring(0, 27);
  }

  addTag(ctx: WebChainedContext<EtagConfig>, response: WebResponse): WebResponse {
    const { request } = ctx;

    const statusCode = response.context.httpStatusCode ?? 200;

    if (
      (response.context.cacheableAge ?? 1) <= 0 || // Response isn't cacheable
      (statusCode >= 300 && statusCode !== 304) || // Ignore redirects
      BinaryUtil.isReadableStream(response.body) // Ignore streams (unknown length)
    ) {
      return response;
    }

    const binaryResponse = new WebResponse({ ...response, ...WebBodyUtil.toBinaryMessage(response) });
    const tag = this.computeTag(castTo<Buffer>(binaryResponse.body));
    binaryResponse.headers.set('ETag', `${ctx.config.weak ? 'W/' : ''}"${tag}"`);

    if (
      ctx.config.cacheable &&
      fresh({
        'if-modified-since': request.headers.get('If-Modified-Since')!,
        'if-none-match': request.headers.get('If-None-Match')!,
        'cache-control': request.headers.get('Cache-Control')!,
      }, {
        etag: binaryResponse.headers.get('ETag')!,
        'last-modified': binaryResponse.headers.get('Last-Modified')!
      })
    ) {
      // Remove length for the 304
      binaryResponse.headers.delete('Content-Length');
      return new WebResponse({
        context: { ...response.context, httpStatusCode: 304 },
        headers: binaryResponse.headers
      });
    }

    return binaryResponse;
  }

  finalizeConfig({ config, endpoint }: WebInterceptorContext<EtagConfig>): EtagConfig {
    if (endpoint.cacheable) {
      return { ...config, cacheable: true };
    }
    return config;
  }

  applies({ config }: WebInterceptorContext<EtagConfig>): boolean {
    return config.applies;
  }

  async filter(ctx: WebChainedContext<EtagConfig>): Promise<WebResponse> {
    return this.addTag(ctx, await ctx.next());
  }
}