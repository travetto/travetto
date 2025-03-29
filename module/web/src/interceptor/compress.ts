import { buffer } from 'node:stream/consumers';
import { BrotliOptions, constants, createBrotliCompress, createDeflate, createGzip, ZlibOptions } from 'node:zlib';

// eslint-disable-next-line @typescript-eslint/naming-convention
import Negotiator from 'negotiator';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError, castTo } from '@travetto/runtime';

import { HttpInterceptor, HttpInterceptorCategory } from '../types/interceptor.ts';
import { HttpContext, HttpChainedContext } from '../types.ts';
import { HttpResponse } from '../types/response.ts';
import { EndpointConfig } from '../registry/types.ts';

const NO_TRANSFORM_REGEX = /(?:^|,)\s*?no-transform\s*?(?:,|$)/;
const ENCODING_METHODS = {
  gzip: createGzip,
  deflate: createDeflate,
  br: createBrotliCompress,
};

type HttpCompressEncoding = keyof typeof ENCODING_METHODS | 'identity';

@Config('web.compress')
export class CompressConfig {
  /**
   * Attempting to compressing responses
   */
  applies: boolean = true;
  /**
   * Raw encoding options
   */
  raw?: (ZlibOptions & BrotliOptions) | undefined;
  /**
   * Preferred encodings
   */
  preferredEncodings?: HttpCompressEncoding[] = ['br', 'gzip', 'identity'];
  /**
   * Supported encodings
   */
  supportedEncodings: HttpCompressEncoding[] = ['br', 'gzip', 'identity', 'deflate'];
}

/**
 * Enables compression support
 */
@Injectable()
export class CompressionInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'response';

  @Inject()
  config: CompressConfig;

  async compress(ctx: HttpContext, res: HttpResponse): Promise<HttpResponse> {
    const { raw = {}, preferredEncodings, supportedEncodings } = this.config;
    const { req } = ctx;

    res.vary('Accept-Encoding');

    const chunkSize = raw.chunkSize ?? constants.Z_DEFAULT_CHUNK;
    if (
      !res.output ||
      (res.length !== undefined && res.length >= 0 && res.length < chunkSize) ||
      req.method === 'HEAD' ||
      res.headers.has('Content-Encoding') ||
      NO_TRANSFORM_REGEX.test(res.headers.get('Cache-Control')?.toString() ?? '')
    ) {
      return res;
    }

    const accepts = req.headers.get('Accept-Encoding');
    const method = new Negotiator({ headers: { 'accept-encoding': accepts ?? '*' } })
      // Bad typings, need to override
      .encoding(...castTo<[string[]]>([supportedEncodings, preferredEncodings]));

    if (accepts && (!method || !accepts.includes(method))) {
      throw Object.assign(
        new AppError(`Please accept one of: ${supportedEncodings.join(', ')}. ${accepts} is not supported`),
        { status: 406 }
      );
    }

    const type = castTo<HttpCompressEncoding>(method!);
    if (type === 'identity') {
      return res;
    }

    const opts = type === 'br' ? { params: { [constants.BROTLI_PARAM_QUALITY]: 4, ...raw.params }, ...raw } : { ...raw };
    const stream = ENCODING_METHODS[type](opts);
    // If we are compressing
    res.headers.set('Content-Encoding', type);

    if (Buffer.isBuffer(res.output)) {
      stream.end(res.output);
      const out = await buffer(stream);
      res.output = out;
      res.length = out.length;
    } else {
      res.output.pipe(stream);
      res.output = stream;
      res.length = undefined;
    }

    return res.ensureContentLength();
  }

  applies(ep: EndpointConfig, config: CompressConfig): boolean {
    return config.applies;
  }

  async filter(ctx: HttpChainedContext): Promise<HttpResponse> {
    return this.compress(ctx, await ctx.next());
  }
}