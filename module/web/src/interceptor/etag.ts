import crypto from 'node:crypto';
import fresh from 'fresh';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { HttpChainedContext, HttpContext, HttpPayload } from '../types.ts';
import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';
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

  addTag(ctx: HttpContext, value?: unknown): unknown {
    const { req, res } = ctx;

    const { output } = ctx.res.setResponse(value);

    if (
      Buffer.isBuffer(output) &&
      (
        !res.statusCode ||
        (res.statusCode < 300 && res.statusCode >= 200) ||
        res.statusCode === 304
      )
    ) {

      const tag = output.length === 0 ?
        '2jmj7l5rSw0yVb/vlWAYkK/YBwk' :
        crypto
          .createHash('sha1')
          .update(output.toString('utf8'), 'utf8')
          .digest('base64')
          .substring(0, 27);

      res.setHeader('ETag', `${this.config.weak ? 'W/' : ''}"${tag}"`);

      const lastModified = res.getHeader('Last-Modified');

      if (
        (req.method === 'GET' || req.method === 'HEAD') &&
        fresh(req.headers, { etag: tag, 'last-modified': lastModified })
      ) {
        return ctx.res.setResponse(new HttpPayload({
          output: Buffer.from([]),
          statusCode: 304,
          source: this,
          headers: {}
        }), true);
      }
    }

    return output;
  }

  applies(ep: EndpointConfig, config: EtagConfig): boolean {
    return config.applies;
  }

  async filter(ctx: HttpChainedContext): Promise<unknown> {
    return this.addTag(ctx, await ctx.next());
  }
}