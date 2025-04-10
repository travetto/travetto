import { Readable } from 'node:stream';
import zlib from 'node:zlib';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError, castTo } from '@travetto/runtime';

import { WebChainedContext } from '../types.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebInterceptor } from '../types/interceptor.ts';
import { WebHeaders } from '../types/headers.ts';
import { WebRequest } from '../types/request.ts';

import { EndpointConfig } from '../registry/types.ts';

const DECOMPRESSORS = {
  gzip: zlib.createGunzip,
  deflate: zlib.createInflate,
  br: zlib.createBrotliDecompress,
  identity: (): Readable => null!
};

type WebDecompressEncoding = keyof typeof DECOMPRESSORS;

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


  static decompress(headers: WebHeaders, stream: Readable, config: DecompressConfig): Readable {
    const encoding: WebDecompressEncoding | 'identity' = castTo(headers.getList('Content-Encoding')?.[0]) ?? 'identity';

    if (!config.supportedEncodings.includes(encoding)) {
      throw WebResponse.fromError(new AppError(`Unsupported Content-Encoding: ${encoding}`))
        .with({ statusCode: 415 });
    }

    return encoding === 'identity' ? stream : stream.pipe(DECOMPRESSORS[encoding]());
  }

  dependsOn = [];
  category: WebInterceptorCategory = 'request';

  @Inject()
  config: DecompressConfig;

  applies(endpoint: EndpointConfig, config: DecompressConfig): boolean {
    return config.applies;
  }

  async filter({ req, config, next }: WebChainedContext<DecompressConfig>): Promise<WebResponse> {
    if (req.body === undefined) {
      const stream = req.getUnprocessedBodyAsStream();
      if (stream) {
        req.body = WebRequest.markUnprocessed(DecompressInterceptor.decompress(req.headers, stream, config));
      }
    }
    return next();
  }
}