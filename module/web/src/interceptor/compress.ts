import { buffer } from 'node:stream/consumers';
import { BrotliOptions, constants, createBrotliCompress, createDeflate, createGzip, ZlibOptions } from 'node:zlib';

// eslint-disable-next-line @typescript-eslint/naming-convention
import Negotiator from 'negotiator';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError, castTo } from '@travetto/runtime';

import { HttpInterceptor, HttpInterceptorCategory } from './types';
import { HttpContext, HttpChainedContext } from '../types';
import { HttpPayloadUtil } from '../util/payload';
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
   * Should this be turned off by default?
   */
  disabled?: boolean;
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

    const data = HttpPayloadUtil.ensureSerialized(ctx, payload);

    const { res, req } = ctx;

    res.vary('Accept-Encoding');

    const length = +(res.getHeader('Content-Length')?.toString() ?? '-1');
    const chunkSize = raw.chunkSize ?? constants.Z_DEFAULT_CHUNK;
    if (
      !data ||
      (length >= 0 && length < chunkSize) ||
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
      const newPayload = HttpPayloadUtil.fromBytes(out, res.getHeader('Content-Type')?.toString());
      return HttpPayloadUtil.applyPayload(ctx, newPayload, out);
    } else {
      data.pipe(stream);
      const newPayload = HttpPayloadUtil.fromStream(stream, res.getHeader('Content-Type')?.toString());
      return HttpPayloadUtil.applyPayload(ctx, newPayload, stream);
    }
  }

  applies(ep: EndpointConfig, config: CompressConfig): boolean {
    return config.disabled !== true;
  }

  async filter(ctx: HttpChainedContext): Promise<unknown> {
    return this.compress(ctx, await ctx.next());
  }
}