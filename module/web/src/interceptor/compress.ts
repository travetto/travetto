import { buffer } from 'node:stream/consumers';
import { BrotliOptions, constants, createBrotliCompress, createDeflate, createGzip, ZlibOptions } from 'node:zlib';

// eslint-disable-next-line @typescript-eslint/naming-convention
import Negotiator from 'negotiator';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError, castTo } from '@travetto/runtime';

import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';
import { HttpContext, HttpChainedContext } from '../types.ts';
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

  async compress(ctx: HttpContext, payload: unknown): Promise<unknown> {
    const { raw = {}, preferredEncodings, supportedEncodings } = this.config;

    const { output: data, length } = ctx.res.setResponse(payload);

    const { res, req } = ctx;

    res.vary('Accept-Encoding');

    const chunkSize = raw.chunkSize ?? constants.Z_DEFAULT_CHUNK;
    if (
      !data ||
      (length !== undefined && length >= 0 && length < chunkSize) ||
      req.method === 'HEAD' ||
      res.getHeader('content-encoding') ||
      NO_TRANSFORM_REGEX.test(res.getHeader('cache-control')?.toString() ?? '')
    ) {
      return data;
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
      return data;
    }

    const opts = type === 'br' ? { params: { [constants.BROTLI_PARAM_QUALITY]: 4, ...raw.params }, ...raw } : { ...raw };
    const stream = ENCODING_METHODS[type](opts);
    // If we are compressing
    res.setHeader('Content-Encoding', type);

    if (Buffer.isBuffer(data)) {
      stream.end(data);
      const out = await buffer(stream);
      ctx.res.setResponse(out);
      return out;
    } else {
      data.pipe(stream);
      ctx.res.setResponse(stream);
      return stream;
    }
  }

  applies(ep: EndpointConfig, config: CompressConfig): boolean {
    return config.applies;
  }

  async filter(ctx: HttpChainedContext): Promise<unknown> {
    return this.compress(ctx, await ctx.next());
  }
}