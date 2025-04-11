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
const COMPRESSORS = {
  gzip: createGzip,
  deflate: createDeflate,
  br: createBrotliCompress,
};

type WebCompressEncoding = keyof typeof COMPRESSORS | 'identity';

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

    res.headers.vary('Accept-Encoding');

    const chunkSize = raw.chunkSize ?? constants.Z_DEFAULT_CHUNK;
    const len = res.headers.getContentLength();
    if (
      !res.body ||
      (len !== undefined && len >= 0 && len < chunkSize) ||
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
    const stream = COMPRESSORS[type](opts);
    const binaryRes = res.toBinary();
    // If we are compressing
    binaryRes.headers.set('Content-Encoding', type);
    binaryRes.headers.delete('Content-Length');

    if (Buffer.isBuffer(binaryRes.body)) {
      stream.end(binaryRes.body);
      const out = await buffer(stream);
      binaryRes.body = out;
    } else {
      binaryRes.body.pipe(stream);
      binaryRes.body = stream;
    }

    return binaryRes;
  }

  applies(ep: EndpointConfig, config: CompressConfig): boolean {
    return config.applies;
  }

  async filter(ctx: WebChainedContext): Promise<WebResponse> {
    return this.compress(ctx, await ctx.next());
  }
}