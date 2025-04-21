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

import { EndpointConfig } from '../registry/types.ts';
import { WebBodyUtil } from '../util/body.ts';

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
      throw new WebResponse({
        body: new AppError(`Unsupported Content-Encoding: ${encoding}`),
        context: {
          httpStatusCode: 415
        }
      });
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

  async filter({ request, config, next }: WebChainedContext<DecompressConfig>): Promise<WebResponse> {
    if (request.body === undefined) {
      const stream = WebBodyUtil.getRawStream(request.body);
      if (stream) {
        request.body = WebBodyUtil.markRaw(DecompressInterceptor.decompress(request.headers, stream, config));
      }
    }
    return next();
  }
}