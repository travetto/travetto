import { buffer } from 'node:stream/consumers';
import { type BrotliOptions, constants, createBrotliCompress, createDeflate, createGzip, type ZlibOptions } from 'node:zlib';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { BinaryUtil } from '@travetto/runtime';

import type { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import type { WebInterceptorCategory } from '../types/core.ts';
import type { WebChainedContext } from '../types/filter.ts';
import { WebResponse } from '../types/response.ts';
import { WebError } from '../types/error.ts';

import { WebBodyUtil } from '../util/body.ts';
import { WebHeaderUtil } from '../util/header.ts';

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

  async compress(ctx: WebChainedContext, response: WebResponse): Promise<WebResponse> {
    const { raw = {}, supportedEncodings } = this.config;
    const { request } = ctx;

    response.headers.append('Vary', 'Accept-Encoding');

    if (
      !response.body ||
      response.headers.has('Content-Encoding') ||
      response.headers.get('Cache-Control')?.includes('no-transform')
    ) {
      return response;
    }

    const accepts = request.headers.get('Accept-Encoding');
    const type = WebHeaderUtil.negotiateHeader(accepts ?? '*', supportedEncodings);

    if (!type) {
      throw WebError.for(`Please accept one of: ${supportedEncodings.join(', ')}. ${accepts} is not supported`, 406);
    }

    if (type === 'identity') {
      return response;
    }

    const binaryResponse = new WebResponse({ context: response.context, ...WebBodyUtil.toBinaryMessage(response) });
    const chunkSize = raw.chunkSize ?? constants.Z_DEFAULT_CHUNK;
    const len = BinaryUtil.isByteArray(binaryResponse.body) ? binaryResponse.body.byteLength : undefined;

    if (len !== undefined && len >= 0 && len < chunkSize || !binaryResponse.body) {
      return binaryResponse;
    }

    const options = type === 'br' ? { params: { [constants.BROTLI_PARAM_QUALITY]: 4, ...raw.params }, ...raw } : { ...raw };
    const stream = COMPRESSORS[type](options);

    // If we are compressing
    binaryResponse.headers.set('Content-Encoding', type);

    if (BinaryUtil.isByteArray(binaryResponse.body)) {
      stream.end(binaryResponse.body);
      const out = await buffer(stream);
      binaryResponse.body = out;
      binaryResponse.headers.set('Content-Length', `${out.byteLength}`);
    } else {
      binaryResponse.body.pipe(stream);
      binaryResponse.body = stream;
      binaryResponse.headers.delete('Content-Length');
    }

    return binaryResponse;
  }

  applies({ config }: WebInterceptorContext<CompressConfig>): boolean {
    return config.applies;
  }

  async filter(ctx: WebChainedContext): Promise<WebResponse> {
    return this.compress(ctx, await ctx.next());
  }
}