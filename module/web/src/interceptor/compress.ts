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
import { WebBodyUtil } from '../util/body.ts';

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

  async compress(ctx: WebChainedContext, response: WebResponse): Promise<WebResponse> {
    const { raw = {}, preferredEncodings = [], supportedEncodings } = this.config;
    const { request } = ctx;

    response.headers.vary('Accept-Encoding');

    if (
      !response.body ||
      response.headers.has('Content-Encoding') ||
      response.headers.get('Cache-Control')?.includes('no-transform')
    ) {
      return response;
    }

    const accepts = request.headers.get('Accept-Encoding');
    const type: WebCompressEncoding | undefined =
      castTo(new Negotiator({ headers: { 'accept-encoding': accepts ?? '*' } })
        .encoding([...supportedEncodings, ...preferredEncodings]));

    if (accepts && (!type || !accepts.includes(type))) {
      throw new WebResponse({
        body: new AppError(`Please accept one of: ${supportedEncodings.join(', ')}. ${accepts} is not supported`),
        context: { httpStatusCode: 406 }
      });
    }

    if (type === 'identity' || !type) {
      return response;
    }

    const binaryResponse = new WebResponse({ context: response.context, ...WebBodyUtil.toBinaryMessage(response) });
    const chunkSize = raw.chunkSize ?? constants.Z_DEFAULT_CHUNK;
    const len = Buffer.isBuffer(binaryResponse.body) ? binaryResponse.body.byteLength : undefined;

    if (len !== undefined && len >= 0 && len < chunkSize || !binaryResponse.body) {
      return binaryResponse;
    }

    const opts = type === 'br' ? { params: { [constants.BROTLI_PARAM_QUALITY]: 4, ...raw.params }, ...raw } : { ...raw };
    const stream = COMPRESSORS[type](opts);

    // If we are compressing
    binaryResponse.headers.set('Content-Encoding', type);

    if (Buffer.isBuffer(binaryResponse.body)) {
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

  applies(ep: EndpointConfig, config: CompressConfig): boolean {
    return config.applies;
  }

  async filter(ctx: WebChainedContext): Promise<WebResponse> {
    return this.compress(ctx, await ctx.next());
  }
}