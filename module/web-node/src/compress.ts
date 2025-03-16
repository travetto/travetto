import { buffer } from 'node:stream/consumers';
import { BrotliOptions, constants, createBrotliCompress, createDeflate, createGzip, ZlibOptions } from 'node:zlib';

// eslint-disable-next-line @typescript-eslint/naming-convention
import Negotiator from 'negotiator';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError, castTo } from '@travetto/runtime';
import {
  FilterContext, HttpRequest, HttpResponse, ManagedInterceptorConfig,
  HttpInterceptor, LoggingInterceptor, WebSymbols
} from '@travetto/web';

import { EtagInterceptor } from './etag';


const NO_TRANSFORM_REGEX = /(?:^|,)\s*?no-transform\s*?(?:,|$)/;
const ENCODING_METHODS = {
  gzip: createGzip,
  deflate: createDeflate,
  br: createBrotliCompress,
};

type HttpCompressEncoding = keyof typeof ENCODING_METHODS | 'identity';

@Config('web.compress')
class CompressConfig extends ManagedInterceptorConfig {
  raw?: (ZlibOptions & BrotliOptions) | undefined;
  preferredEncodings?: HttpCompressEncoding[] = ['br', 'gzip', 'identity'];
  supportedEncodings: HttpCompressEncoding[] = ['br', 'gzip', 'identity', 'deflate'];
}

/**
 * Enables compression support
 */
@Injectable()
export class CompressionInterceptor implements HttpInterceptor {

  runsBefore = [EtagInterceptor];
  dependsOn = [LoggingInterceptor];

  @Inject()
  config: CompressConfig;

  async compress(req: HttpRequest, res: HttpResponse): Promise<void> {
    const { raw = {}, preferredEncodings, supportedEncodings } = this.config;

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
      throw Object.assign(
        new AppError(`Please accept one of: ${supportedEncodings.join(', ')}. ${sent} is not supported`),
        { status: 406 }
      );
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

  async intercept({ res }: FilterContext<CompressConfig>): Promise<void> {
    res.vary('Accept-Encoding');
    (res[WebSymbols.Internal].filters ??= []).push(this.compress.bind(this));
  }
}