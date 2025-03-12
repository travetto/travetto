import { Duplex } from 'node:stream';
import { BrotliOptions, constants, createBrotliCompress, createDeflate, createGzip, ZlibOptions } from 'node:zlib';

// eslint-disable-next-line @typescript-eslint/naming-convention
import Negotiator from 'negotiator';

import { AppError, castTo } from '@travetto/runtime';
import { HttpPayload, HttpRequest, HttpResponse } from '../types';

const NO_TRANSFORM_REGEX = /(?:^|,)\s*?no-transform\s*?(?:,|$)/;
const ENCODING_METHODS = {
  gzip: createGzip,
  deflate: createDeflate,
  br: createBrotliCompress,
  identity: (_?: {}): undefined => undefined
};

type HttpCompressType = keyof typeof ENCODING_METHODS;

export class HttpCompressConfig {
  preferredEncodings: HttpCompressType[] = ['br', 'gzip'];
  supportedEncodings: HttpCompressType[] = ['br', 'gzip', 'deflate', 'identity'];
  options: ZlibOptions | BrotliOptions = {
    chunkSize: 2 ** 14,
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 4
    }
  };
};

export class HttpCompressionUtil {

  static shouldCompress(config: HttpCompressConfig, req: HttpRequest, res: HttpResponse, basic: HttpPayload): boolean {
    return (basic.length === undefined || basic.length > config.options.chunkSize!) &&
      req.method !== 'HEAD' &&
      !res.getHeader('content-encoding') &&
      !NO_TRANSFORM_REGEX.test(res.getHeader('cache-control')?.toString() ?? '');
  }

  static getCompressor(config: HttpCompressConfig, acceptEncoding = '*'): Duplex | undefined {
    const method = new Negotiator({ headers: { 'Accept-Encoding': acceptEncoding } })
      // Bad typings, need to override
      .encoding(...castTo<[string[]]>([config.supportedEncodings, config.preferredEncodings]));

    if (!method) {
      const err = new AppError(`Please accept one of: ${config.supportedEncodings.join(',')}.`);
      Object.assign(err, { statusCode: 406 });
      throw err;
    }

    const type = castTo<HttpCompressType>(method!);
    return ENCODING_METHODS[type](config.options);
  }
}
