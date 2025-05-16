import { buffer } from 'node:stream/consumers';
import { Readable } from 'node:stream';

import { AppError, BinaryUtil, castTo } from '@travetto/runtime';
import { BindUtil } from '@travetto/schema';

import { WebResponse } from '../../src/types/response.ts';
import { WebRequest } from '../../src/types/request.ts';
import { DecompressInterceptor } from '../../src/interceptor/decompress.ts';
import { WebBodyUtil } from '../../src/util/body.ts';
import { WebCommonUtil } from '../../src/util/common.ts';

const toBuffer = (src: Buffer | Readable) => Buffer.isBuffer(src) ? src : buffer(src);

/**
 * Utilities for supporting custom test dispatchers
 */
export class WebTestDispatchUtil {

  static async applyRequestBody(request: WebRequest): Promise<WebRequest> {
    if (request.body !== undefined) {
      const sample = WebBodyUtil.toBinaryMessage(request);
      sample.headers.forEach((v, k) => request.headers.set(k, Array.isArray(v) ? v.join(',') : v));
      request.body = WebBodyUtil.markRaw(await toBuffer(sample.body!));
    }
    Object.assign(request.context, { httpQuery: BindUtil.flattenPaths(request.context.httpQuery ?? {}) });
    return request;
  }

  static async finalizeResponseBody(response: WebResponse, decompress?: boolean): Promise<WebResponse> {
    let result = response.body;

    response.context.httpStatusCode = WebCommonUtil.getStatusCode(response);

    if (decompress) {
      if (Buffer.isBuffer(result) || BinaryUtil.isReadable(result)) {
        const bufferResult = result = await toBuffer(result);
        if (bufferResult.length) {
          try {
            result = await DecompressInterceptor.decompress(
              response.headers,
              bufferResult,
              { applies: true, supportedEncodings: ['br', 'deflate', 'gzip', 'identity'] }
            );
          } catch { }
        }
      }
    }

    const text = Buffer.isBuffer(result) ? result.toString('utf8') : (typeof result === 'string' ? result : undefined);

    if (text) {
      switch (response.headers.get('Content-Type')) {
        case 'application/json': result = JSON.parse(castTo(text)); break;
        case 'text/plain': result = text; break;
      }
    }

    if (response.context.httpStatusCode && response.context.httpStatusCode >= 400) {
      result = WebCommonUtil.catchResponse(AppError.fromJSON(result) ?? result).body;
    }

    response.body = result;
    return response;
  }

  static buildPath(request: WebRequest): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(request.context.httpQuery ?? {})) {
      params.set(k, v === null || v === undefined ? '' : `${v}`);
    }
    return [request.context.path, params.toString()].join('?').replace(/[?]$/, '');
  }
}