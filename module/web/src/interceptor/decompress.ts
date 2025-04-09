import zlib from 'node:zlib';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError, castTo } from '@travetto/runtime';

import { WebChainedContext } from '../types.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebInterceptor } from '../types/interceptor.ts';

import { EndpointConfig } from '../registry/types.ts';

const DECOMPRESSORS = {
  gzip: zlib.createGunzip,
  deflate: zlib.createInflate,
  br: zlib.createBrotliDecompress,
};

type WebDecompressEncoding = keyof typeof DECOMPRESSORS | 'identity';

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
  supportedEncodings: WebDecompressEncoding[] = ['br', 'gzip', 'identity', 'deflate'];
}

/**
 * Decompress body
 */
@Injectable()
export class DecompressInterceptor implements WebInterceptor<DecompressConfig> {

  dependsOn = [];
  category: WebInterceptorCategory = 'request';

  @Inject()
  config: DecompressConfig;

  applies(endpoint: EndpointConfig, config: DecompressConfig): boolean {
    return config.applies;
  }

  async filter({ req, config, next }: WebChainedContext<DecompressConfig>): Promise<WebResponse> {
    const encoding: WebDecompressEncoding = castTo(req.headers.getList('Content-Encoding')?.[0]) ?? 'identity';

    if (!req.inputStream || encoding === 'identity') {
      return next();
    } else if (!config.supportedEncodings.includes(encoding)) {
      return WebResponse.fromError(new AppError(`Unsupported Content-Encoding: ${encoding}`))
        .with({ statusCode: 415 });
    }

    req.replaceInputStream(req.inputStream.pipe(DECOMPRESSORS[encoding]()));
    return next();
  }
}