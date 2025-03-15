import { buffer } from 'node:stream/consumers';
import { BrotliOptions, constants, createBrotliCompress, createDeflate, createGzip, ZlibOptions } from 'node:zlib';

// eslint-disable-next-line @typescript-eslint/naming-convention
import Negotiator from 'negotiator';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError, castTo } from '@travetto/runtime';

import { WebSymbols } from '../symbols.ts';

import { FilterContext, FilterNext } from '../types.ts';
import { ManagedInterceptorConfig, HttpInterceptor } from './types.ts';
import { EtagInterceptor } from './etag.ts';

const NO_TRANSFORM_REGEX = /(?:^|,)\s*?no-transform\s*?(?:,|$)/;
const ENCODING_METHODS = {
  gzip: createGzip,
  deflate: createDeflate,
  br: createBrotliCompress,
};

type HttpCompressEncoding = keyof typeof ENCODING_METHODS | 'identity';

@Config('web.compress')
class WebCompressConfig extends ManagedInterceptorConfig {
  raw?: (ZlibOptions & BrotliOptions) | undefined;
  preferredEncodings?: HttpCompressEncoding[];
  supportedEncodings: HttpCompressEncoding[];
}

/**
 * Enables compression support
 */
@Injectable()
export class CompressionInterceptor implements HttpInterceptor {

  runsBefore = [EtagInterceptor];

  @Inject()
  config: WebCompressConfig;

  async intercept({ res, req, config }: FilterContext<WebCompressConfig>, next: FilterNext): Promise<unknown> {
    try {
      res.vary('Accept-Encoding');
      return await next();
    } finally {
      const { raw = {}, preferredEncodings, supportedEncodings } = config;

      const data = res[WebSymbols.Internal].body;
      const length = +(res.getHeader('Content-Length')?.toString() ?? '-1');
      const chunkSize = raw.chunkSize ?? constants.Z_DEFAULT_CHUNK;
      if (
        !data ||
        (length >= 0 && length < chunkSize) ||
        req.method === 'HEAD' ||
        res.getHeader('content-encoding') ||
        NO_TRANSFORM_REGEX.test(res.getHeader('cache-control')?.toString() ?? '')
      ) {
        return;
      }

      const sent = req.headerFirst('accept-encoding');
      const method = new Negotiator({ headers: { 'accept-encoding': sent ?? '*' } })
        // Bad typings, need to override
        .encoding(...castTo<[string[]]>([supportedEncodings, preferredEncodings]));

      if (sent && (!method || !sent.includes(method))) {
        const err = new AppError(`Please accept one of: ${supportedEncodings.join(', ')}. ${sent} is not supported`);
        Object.assign(err, { statusCode: 406 });
        throw err;
      }

      const type = castTo<HttpCompressEncoding>(method!);
      if (type === 'identity') {
        return;
      }

      const opts = type === 'br' ? { params: { [constants.BROTLI_PARAM_QUALITY]: 4, ...raw.params }, ...raw } : { ...raw };
      const stream = ENCODING_METHODS[type](opts);
      // If we are compressing
      res.setHeader('Content-Encoding', type);

      if (Buffer.isBuffer(data)) {
        stream.end(data);
        const out = await buffer(stream);
        res.setHeader('Content-Length', `${out.length}`);
        res[WebSymbols.Internal].body = out;
      } else {
        data.pipe(stream);
        res[WebSymbols.Internal].body = stream;
      }
    }
  }
}