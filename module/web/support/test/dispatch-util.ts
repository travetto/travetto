import { BinaryUtil, castTo, type BinaryType, type BinaryArray, CodecUtil, JSONUtil } from '@travetto/runtime';
import { BindUtil } from '@travetto/schema';

import type { WebResponse } from '../../src/types/response.ts';
import type { WebRequest } from '../../src/types/request.ts';
import { DecompressInterceptor } from '../../src/interceptor/decompress.ts';
import { WebBodyUtil } from '../../src/util/body.ts';
import { WebCommonUtil } from '../../src/util/common.ts';

/**
 * Utilities for supporting custom test dispatchers
 */
export class WebTestDispatchUtil {

  static async applyRequestBody(request: WebRequest, toByteArray: true): Promise<WebRequest<BinaryArray>>;
  static async applyRequestBody(request: WebRequest, toByteArray?: false): Promise<WebRequest<BinaryType>>;
  static async applyRequestBody(request: WebRequest, toByteArray: boolean = false): Promise<WebRequest<BinaryType>> {
    if (request.body !== undefined) {
      const sample = WebBodyUtil.toBinaryMessage(request);
      sample.headers.forEach((v, k) => request.headers.set(k, Array.isArray(v) ? v.join(',') : v));
      if (toByteArray) {
        sample.body = sample.body ?
          await BinaryUtil.toBinaryArray(sample.body) :
          BinaryUtil.makeBinaryArray(0);
      }
      request.body = WebBodyUtil.markRawBinary(sample.body);
    }
    Object.assign(request.context, { httpQuery: BindUtil.flattenPaths(request.context.httpQuery ?? {}) });
    return castTo(request);
  }

  static async finalizeResponseBody(response: WebResponse, decompress?: boolean): Promise<WebResponse> {
    let result = response.body;

    response.context.httpStatusCode = WebCommonUtil.getStatusCode(response);

    if (decompress && BinaryUtil.isBinaryType(result)) {
      const bufferResult = result = await BinaryUtil.toBinaryArray(result);
      if (bufferResult.byteLength) {
        try {
          result = await DecompressInterceptor.decompress(
            response.headers,
            bufferResult,
            { applies: true, supportedEncodings: ['br', 'deflate', 'gzip', 'identity'] }
          );
        } catch { }
      }
    }

    const isJSON = response.headers.get('Content-Type') === 'application/json';
    const isText = response.headers.get('Content-Type')?.startsWith('text/') ?? false;

    if (BinaryUtil.isBinaryArray(result) && (isJSON || isText)) {
      result = CodecUtil.toUTF8String(result);
    }

    if (typeof result === 'string' && isJSON) {
      result = JSONUtil.fromUTF8(result, { reviver: JSONUtil.TRANSMIT_REVIVER });
    }

    if (response.context.httpStatusCode && response.context.httpStatusCode >= 400) {
      result = WebCommonUtil.catchResponse(result).body;
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