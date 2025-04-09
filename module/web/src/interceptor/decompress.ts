import zlib from 'node:zlib';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError, castTo } from '@travetto/runtime';

import { WebChainedContext } from '../types.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebInterceptor } from '../types/interceptor.ts';

import { EndpointConfig } from '../registry/types.ts';
import { Readable } from 'node:stream';
import { WebHeaders } from '@travetto/web';

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

    if (encoding === 'identity') {
      return stream;
    } else {
      return stream.pipe(DECOMPRESSORS[encoding]());
    }
  }

  dependsOn = [];
  category: WebInterceptorCategory = 'request';

  @Inject()
  config: DecompressConfig;

  applies(endpoint: EndpointConfig, config: DecompressConfig): boolean {
    return config.applies;
  }

  async filter({ req, config, next }: WebChainedContext<DecompressConfig>): Promise<WebResponse> {
    if (req.inputStream) {
      req.replaceInputStream(DecompressInterceptor.decompress(req.headers, req.inputStream, config));
    }
    return next();
  }
}