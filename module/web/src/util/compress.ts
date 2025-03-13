import { Duplex } from 'node:stream';
import { BrotliOptions, constants, createBrotliCompress, createDeflate, createGzip, ZlibOptions } from 'node:zlib';

// eslint-disable-next-line @typescript-eslint/naming-convention
import Negotiator from 'negotiator';

import { AppError, castTo } from '@travetto/runtime';

import { HttpRequest, HttpResponse } from '../types.ts';

const NO_TRANSFORM_REGEX = /(?:^|,)\s*?no-transform\s*?(?:,|$)/;
const ENCODING_METHODS = {
  gzip: createGzip,
  deflate: createDeflate,
  br: createBrotliCompress,
  identity: (_?: {}): undefined => undefined
};

export type HttpCompressOptions = ZlibOptions & BrotliOptions;
export type HttpCompressEncoding = keyof typeof ENCODING_METHODS;

export class HttpCompressionUtil {

  static getCompressor(
    req: HttpRequest, res: HttpResponse,
    options: HttpCompressOptions,
    supportedEncodings: HttpCompressEncoding[],
    preferredEncodings = supportedEncodings
  ): { type: HttpCompressEncoding, stream: Duplex | undefined } {
    const length = +(res.getHeader('Content-Length')?.toString() ?? '-1');
    const chunkSize = options?.chunkSize ?? constants.Z_DEFAULT_CHUNK;

    if (
      (length >= 0 && length < chunkSize) ||
      req.method === 'HEAD' ||
      res.getHeader('content-encoding') ||
      NO_TRANSFORM_REGEX.test(res.getHeader('cache-control')?.toString() ?? '')
    ) {
      return { type: 'identity', stream: undefined };
    }

    const sent = req.headerFirst('accept-encoding');
    const method = new Negotiator({ headers: { 'accept-encoding': sent ?? '*' } })
      // Bad typings, need to override
      .encoding(...castTo<[string[]]>([supportedEncodings, preferredEncodings]));

    if (sent && (!method || !sent.includes(method))) {
      const err = new AppError(`Please accept one of: ${supportedEncodings.join(', ')}. ${sent} is not supported`);
      Object.assign(err, { statusCode: 406 });
      throw err;
    }

    const type = castTo<HttpCompressEncoding>(method!);
    const opts = type === 'br' ? { params: { [constants.BROTLI_PARAM_QUALITY]: 4, ...options?.params }, ...options } : { ...options };
    return { type, stream: ENCODING_METHODS[type](opts) };
  }
}
