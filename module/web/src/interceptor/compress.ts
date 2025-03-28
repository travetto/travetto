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

  async compress(ctx: HttpContext, payload: HttpResponse): Promise<HttpResponse> {
    const { raw = {}, preferredEncodings, supportedEncodings } = this.config;
    const { req } = ctx;

    payload.vary('Accept-Encoding');

    const chunkSize = raw.chunkSize ?? constants.Z_DEFAULT_CHUNK;
    if (
      !payload.output ||
      (payload.length !== undefined && payload.length >= 0 && payload.length < chunkSize) ||
      req.method === 'HEAD' ||
      payload.headers.has('content-encoding') ||
      NO_TRANSFORM_REGEX.test(payload.headers.get('cache-control')?.toString() ?? '')
    ) {
      return payload;
    }

    const accepts = req.headers.getFirst('accept-encoding');
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
      return payload;
    }

    const opts = type === 'br' ? { params: { [constants.BROTLI_PARAM_QUALITY]: 4, ...raw.params }, ...raw } : { ...raw };
    const stream = ENCODING_METHODS[type](opts);
    // If we are compressing
    payload.headers.set('Content-Encoding', type);

    if (Buffer.isBuffer(payload.output)) {
      stream.end(payload.output);
      const out = await buffer(stream);
      payload.output = out;
    } else {
      payload.output.pipe(stream);
      payload.output = stream;
    }

    return payload;
  }

  applies(ep: EndpointConfig, config: CompressConfig): boolean {
    return config.applies;
  }

  async filter(ctx: HttpChainedContext): Promise<HttpResponse> {
    return this.compress(ctx, await ctx.next());
  }
}