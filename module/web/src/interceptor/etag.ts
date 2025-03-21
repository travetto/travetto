import crypto from 'node:crypto';
import fresh from 'fresh';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { HttpRequest, HttpResponse, HttpContext, HttpResponsePayload, WebFilterNext } from '../types';
import { ManagedInterceptorConfig, HttpInterceptor, HttpInterceptorCategory } from './types';
import { HttpPayloadUtil } from '../util/payload';
import { GetCacheInterceptor } from './get-cache';

@Config('web.etag')
export class EtagConfig extends ManagedInterceptorConfig {
  weak?: boolean;
}

/**
 * Enables etag support
 */
@Injectable()
export class EtagInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'response';
  runsBefore = [GetCacheInterceptor];

  @Inject()
  config: EtagConfig;

  addTag(req: HttpRequest, res: HttpResponse, value?: unknown): HttpResponsePayload {
    const output = HttpPayloadUtil.ensureSerialized(req, res, value);
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
        res.statusCode = 304;
        return Buffer.from([]);
      }
    }
    return output;
  }

  async intercept({ req, res }: HttpContext, next: WebFilterNext): Promise<unknown> {
    const value = await next();
    return this.addTag(req, res, value);
  }
}