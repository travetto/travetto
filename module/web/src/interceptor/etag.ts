import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';
import { BinaryUtil, type BinaryArray } from '@travetto/runtime';

import type { WebChainedContext } from '../types/filter.ts';
import { WebResponse } from '../types/response.ts';
import type { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import type { WebInterceptorCategory } from '../types/core.ts';
import { CompressInterceptor } from './compress.ts';
import { WebBodyUtil } from '../util/body.ts';
import { type ByteSizeInput, WebCommonUtil } from '../util/common.ts';
import { WebHeaderUtil } from '../util/header.ts';

@Config('web.etag')
export class EtagConfig {
  /**
   * Attempt ETag generation
   */
  applies = true;
  /**
   * Should we generate a weak etag
   */
  weak?: boolean;
  /**
   * Threshold for tagging avoids tagging small responses
   */
  minimumSize: ByteSizeInput = '10kb';

  @Ignore()
  cacheable?: boolean;

  @Ignore()
  _minimumSize: number | undefined;
}

/**
 * Enables etag support
 */
@Injectable()
export class EtagInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'response';
  dependsOn = [CompressInterceptor];

  @Inject()
  config: EtagConfig;

  computeTag(body: BinaryArray): string {
    return body.byteLength === 0 ?
      '2jmj7l5rSw0yVb/vlWAYkK/YBwk' :
      BinaryUtil.hash(body, { length: 27, hashAlgorithm: 'sha1', outputEncoding: 'base64' });
  }

  addTag(ctx: WebChainedContext<EtagConfig>, response: WebResponse): WebResponse {
    const { request } = ctx;

    const statusCode = response.context.httpStatusCode ?? 200;

    if (
      (statusCode >= 300 && statusCode !== 304) || // Ignore redirects
      BinaryUtil.isBinaryStream(response.body) // Ignore streams (unknown length)
    ) {
      return response;
    }

    const binaryResponse = new WebResponse({ ...response, ...WebBodyUtil.toBinaryMessage(response) });

    const body = binaryResponse.body;
    if (!BinaryUtil.isBinaryArray(body)) {
      return binaryResponse;
    }

    const minSize = ctx.config._minimumSize ??= WebCommonUtil.parseByteSize(ctx.config.minimumSize);
    if (body.byteLength < minSize) {
      return binaryResponse;
    }

    const tag = this.computeTag(body);
    binaryResponse.headers.set('ETag', `${ctx.config.weak ? 'W/' : ''}"${tag}"`);

    if (ctx.config.cacheable && WebHeaderUtil.isFresh(request.headers, binaryResponse.headers)) {
      // Remove length for the 304
      binaryResponse.headers.delete('Content-Length');
      return new WebResponse({
        context: { ...response.context, httpStatusCode: 304 },
        headers: binaryResponse.headers
      });
    }

    return binaryResponse;
  }

  finalizeConfig({ config, endpoint }: WebInterceptorContext<EtagConfig>): EtagConfig {
    if (endpoint.cacheable) {
      return { ...config, cacheable: true };
    }
    return config;
  }

  applies({ config }: WebInterceptorContext<EtagConfig>): boolean {
    return config.applies;
  }

  async filter(ctx: WebChainedContext<EtagConfig>): Promise<WebResponse> {
    return this.addTag(ctx, await ctx.next());
  }
}