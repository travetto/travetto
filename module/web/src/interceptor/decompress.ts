import type { Readable } from 'node:stream';
import zlib from 'node:zlib';
import util from 'node:util';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { castTo } from '@travetto/runtime';

import type { WebChainedContext } from '../types/filter.ts';
import type { WebResponse } from '../types/response.ts';
import type { WebInterceptorCategory } from '../types/core.ts';
import type { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import type { WebHeaders } from '../types/headers.ts';

import { WebBodyUtil } from '../util/body.ts';
import { WebError } from '../types/error.ts';
import type { WebBinaryBody } from '../types/message.ts';

const STREAM_DECOMPRESSORS = {
  gzip: zlib.createGunzip,
  deflate: zlib.createInflate,
  br: zlib.createBrotliDecompress,
  identity: (): Readable => null!
};

const BUFFER_DECOMPRESSORS = {
  gzip: util.promisify(zlib.gunzip),
  deflate: util.promisify(zlib.inflate),
  br: util.promisify(zlib.brotliDecompress),
  identity: (): Readable => null!
};

type WebDecompressEncoding = keyof typeof BUFFER_DECOMPRESSORS;

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

  static async decompress(headers: WebHeaders, input: WebBinaryBody, config: DecompressConfig): Promise<typeof input> {
    const encoding: WebDecompressEncoding | 'identity' = castTo(headers.getList('Content-Encoding')?.[0]) ?? 'identity';

    if (!config.supportedEncodings.includes(encoding)) {
      throw WebError.for(`Unsupported Content-Encoding: ${encoding}`, 415);
    }

    if (encoding === 'identity') {
      return input;
    }

    if (Buffer.isBuffer(input)) {
      return BUFFER_DECOMPRESSORS[encoding](input);
    } else {
      return input.pipe(STREAM_DECOMPRESSORS[encoding]());
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
    if (WebBodyUtil.isRaw(request.body)) {
      const updatedBody = await DecompressInterceptor.decompress(request.headers, request.body, config);
      request.body = WebBodyUtil.markRaw(updatedBody);
    }
    return next();
  }
}