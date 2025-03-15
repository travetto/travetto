import crypto from 'node:crypto';
import fresh from 'fresh';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { WebSymbols } from '@travetto/web/src/symbols.ts';

import {
  FilterContext, HttpRequest, HttpResponse, ManagedInterceptorConfig,
  HttpInterceptor, SerializeInterceptor, LoggingInterceptor
} from '@travetto/web';

@Config('web.etag')
class EtagConfig extends ManagedInterceptorConfig {
  weak?: boolean;
}

/**
 * Enables etag support
 */
@Injectable()
export class EtagInterceptor implements HttpInterceptor {

  runsBefore = [SerializeInterceptor];
  dependsOn = [LoggingInterceptor];

  @Inject()
  config: EtagConfig;

  async etag(req: HttpRequest, res: HttpResponse): Promise<void> {
    const output = res[WebSymbols.Internal].body;
    if (
      Buffer.isBuffer(output) &&
      (req.method === 'GET' || req.method === 'HEAD') &&
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
      if (fresh(req.headers, { etag: tag, 'last-modified': lastModified })) {
        res.statusCode = 304;
        res.end();
      }
    }
  }

  async intercept({ res }: FilterContext): Promise<void> {
    (res[WebSymbols.Internal].filters ??= []).push(this.etag.bind(this));
  }
}