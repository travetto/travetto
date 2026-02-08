import zlib from 'node:zlib';
import util from 'node:util';

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

const STREAM_COMPRESSORS = {
  gzip: zlib.createGzip,
  deflate: zlib.createDeflate,
  br: zlib.createBrotliCompress,
};

const ARRAY_COMPRESSORS = {
  gzip: util.promisify(zlib.gzip),
  deflate: util.promisify(zlib.deflate),
  br: util.promisify(zlib.brotliCompress),
};

type WebCompressEncoding = keyof typeof ARRAY_COMPRESSORS | 'identity';

@Config('web.compress')
export class CompressConfig {
  /**
   * Attempting to compressing responses
   */
  applies: boolean = true;
  /**
   * Raw encoding options
   */
  raw?: (zlib.ZlibOptions & zlib.BrotliOptions) | undefined;
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
    const encoding = WebHeaderUtil.negotiateHeader(accepts ?? '*', supportedEncodings);

    if (!encoding) {
      throw WebError.for(`Please accept one of: ${supportedEncodings.join(', ')}. ${accepts} is not supported`, 406);
    }

    if (encoding === 'identity') {
      return response;
    }

    const binaryResponse = new WebResponse({ context: response.context, ...WebBodyUtil.toBinaryMessage(response) });
    const chunkSize = raw.chunkSize ?? zlib.constants.Z_DEFAULT_CHUNK;
    const len = BinaryUtil.isBinaryArray(binaryResponse.body) ? binaryResponse.body.byteLength : undefined;

    if (len !== undefined && len >= 0 && len < chunkSize || !binaryResponse.body) {
      return binaryResponse;
    }

    const options = encoding === 'br' ? { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4, ...raw.params }, ...raw } : { ...raw };

    // If we are compressing
    binaryResponse.headers.set('Content-Encoding', encoding);

    if (BinaryUtil.isBinaryArray(binaryResponse.body)) {
      const compressor = ARRAY_COMPRESSORS[encoding];
      const out = await compressor(await BinaryUtil.toBuffer(binaryResponse.body), options);
      binaryResponse.body = out;
      binaryResponse.headers.set('Content-Length', `${out.byteLength}`);
    } else {
      const compressedStream = STREAM_COMPRESSORS[encoding](options);
      void BinaryUtil.pipeline(binaryResponse.body, compressedStream);
      binaryResponse.body = compressedStream;
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