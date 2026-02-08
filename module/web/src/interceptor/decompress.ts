import zlib from 'node:zlib';
import util from 'node:util';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { BinaryUtil, castTo, type BinaryType } from '@travetto/runtime';

import type { WebChainedContext } from '../types/filter.ts';
import type { WebResponse } from '../types/response.ts';
import type { WebInterceptorCategory } from '../types/core.ts';
import type { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import type { WebHeaders } from '../types/headers.ts';

import { WebBodyUtil } from '../util/body.ts';
import { WebError } from '../types/error.ts';

const STREAM_DECOMPRESSORS = {
  gzip: zlib.createGunzip,
  deflate: zlib.createInflate,
  br: zlib.createBrotliDecompress
};

const BUFFER_DECOMPRESSORS = {
  gzip: util.promisify(zlib.gunzip),
  deflate: util.promisify(zlib.inflate),
  br: util.promisify(zlib.brotliDecompress)
};

type WebDecompressEncoding = (keyof typeof BUFFER_DECOMPRESSORS) | 'identity';

/**
 * Web body parse configuration
 */
@Config('web.decompress')
export class DecompressConfig {
  /**
   * Parse request body
   */
  applies: boolean = true;
  /**
   * Supported encodings
   */
  supportedEncodings: WebDecompressEncoding[] = ['br', 'gzip', 'deflate', 'identity'];
}

/**
 * Decompress body
 */
@Injectable()
export class DecompressInterceptor implements WebInterceptor<DecompressConfig> {

  static async decompress(headers: WebHeaders, input: BinaryType, config: DecompressConfig): Promise<BinaryType> {
    const encoding: WebDecompressEncoding = castTo(headers.getList('Content-Encoding')?.[0]) ?? 'identity';

    if (!config.supportedEncodings.includes(encoding)) {
      throw WebError.for(`Unsupported Content-Encoding: ${encoding}`, 415);
    }

    if (encoding === 'identity') {
      return input;
    }

    if (BinaryUtil.isBinaryArray(input)) {
      return BUFFER_DECOMPRESSORS[encoding](await BinaryUtil.toBinaryArray(input));
    } else if (BinaryUtil.isBinaryStream(input)) {
      const output = STREAM_DECOMPRESSORS[encoding]();
      BinaryUtil.pipeline(input, output);
      return output;
    } else {
      throw WebError.for('Unable to decompress body: unsupported type', 400);
    }
  }

  dependsOn = [];
  category: WebInterceptorCategory = 'request';

  @Inject()
  config: DecompressConfig;

  applies({ config }: WebInterceptorContext<DecompressConfig>): boolean {
    return config.applies;
  }

  async filter({ request, config, next }: WebChainedContext<DecompressConfig>): Promise<WebResponse> {
    if (WebBodyUtil.isRawBinary(request.body)) {
      const updatedBody = await DecompressInterceptor.decompress(request.headers, request.body, config);
      request.body = WebBodyUtil.markRawBinary(updatedBody);
    }
    return next();
  }
}