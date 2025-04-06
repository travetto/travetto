import { buffer } from 'node:stream/consumers';
import { BrotliOptions, constants, createBrotliCompress, createDeflate, createGzip, ZlibOptions } from 'node:zlib';

// eslint-disable-next-line @typescript-eslint/naming-convention
import Negotiator from 'negotiator';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError, castTo } from '@travetto/runtime';

import { WebInterceptor } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebChainedContext } from '../types.ts';
import { WebResponse } from '../types/response.ts';
import { EndpointConfig } from '../registry/types.ts';

const NO_TRANSFORM_REGEX = /(?:^|,)\s*?no-transform\s*?(?:,|$)/;
const ENCODING_METHODS = {
  gzip: createGzip,
  deflate: createDeflate,
  br: createBrotliCompress,
};

type WebCompressEncoding = keyof typeof ENCODING_METHODS | 'identity';

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
  preferredEncodings?: WebCompressEncoding[] = ['br', 'gzip', 'identity'];
  /**
   * Supported encodings
   */
  supportedEncodings: WebCompressEncoding[] = ['br', 'gzip', 'identity', 'deflate'];
}

/**
 * Enables compression support
 */
@Injectable()
export class CompressInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'response';

  @Inject()
  config: CompressConfig;

  async compress(ctx: WebChainedContext, res: WebResponse): Promise<WebResponse> {
    const { raw = {}, preferredEncodings, supportedEncodings } = this.config;
    const { req } = ctx;

    res.vary('Accept-Encoding');

    const chunkSize = raw.chunkSize ?? constants.Z_DEFAULT_CHUNK;
    if (
      !res.body ||
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

    const type = castTo<WebCompressEncoding>(method!);
    if (type === 'identity') {
      return res;
    }

    const opts = type === 'br' ? { params: { [constants.BROTLI_PARAM_QUALITY]: 4, ...raw.params }, ...raw } : { ...raw };
    const stream = ENCODING_METHODS[type](opts);
    // If we are compressing
    res.headers.set('Content-Encoding', type);

    if (Buffer.isBuffer(res.body)) {
      stream.end(res.body);
      const out = await buffer(stream);
      res.body = out;
      res.length = out.length;
    } else {
      res.body.pipe(stream);
      res.body = stream;
      res.length = undefined;
    }

    return res.ensureContentLength();
  }

  applies(ep: EndpointConfig, config: CompressConfig): boolean {
    return config.applies;
  }

  async filter(ctx: WebChainedContext): Promise<WebResponse> {
    return this.compress(ctx, await ctx.next());
  }
}