import crypto from 'node:crypto';
import fresh from 'fresh';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { WebChainedContext } from '../types.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptor } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { CompressInterceptor } from './compress.ts';
import { EndpointConfig } from '../registry/types.ts';
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

  addTag(ctx: WebChainedContext, res: WebResponse): WebResponse {
    const { req } = ctx;

    if (res.statusCode && (res.statusCode >= 300 && res.statusCode !== 304)) {
      return res;
    }

    const binaryRes = new WebResponse({ ...res, ...WebBodyUtil.toBinaryMessage(res) });
    if (!Buffer.isBuffer(binaryRes.body)) {
      return binaryRes;
    }

    const tag = binaryRes.body.byteLength === 0 ?
      '2jmj7l5rSw0yVb/vlWAYkK/YBwk' :
      crypto
        .createHash('sha1')
        .update(binaryRes.body.toString('utf8'), 'utf8')
        .digest('base64')
        .substring(0, 27);

    binaryRes.headers.set('ETag', `${this.config.weak ? 'W/' : ''}"${tag}"`);

    const lastModified = binaryRes.headers.get('Last-Modified');

    if (
      (req.method === 'GET' || req.method === 'HEAD') &&
      fresh({
        'if-modified-since': req.headers.get('If-Modified-Since')!,
        'if-none-match': req.headers.get('If-None-Match')!,
        'cache-control': req.headers.get('Cache-Control')!,
      }, { etag: tag, 'last-modified': lastModified! })
    ) {
      return new WebResponse({ body: null, statusCode: 304 });
    }

    return binaryRes;
  }

  applies(ep: EndpointConfig, config: EtagConfig): boolean {
    return config.applies;
  }

  async filter(ctx: WebChainedContext): Promise<WebResponse> {
    return this.addTag(ctx, await ctx.next());
  }
}