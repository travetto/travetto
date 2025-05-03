import { buffer as toBuffer } from 'node:stream/consumers';

import { AppError, BinaryUtil, castTo } from '@travetto/runtime';
import { BindUtil } from '@travetto/schema';

import { WebResponse } from '../../src/types/response.ts';
import { WebRequest } from '../../src/types/request.ts';
import { DecompressInterceptor } from '../../src/interceptor/decompress.ts';
import { WebBodyUtil } from '../../src/util/body.ts';
import { WebCommonUtil } from '../../src/util/common.ts';

/**
 * Utilities for supporting custom test dispatchers
 */
export class WebTestDispatchUtil {

  static async applyRequestBody(request: WebRequest): Promise<WebRequest> {
    if (request.body !== undefined) {
      const sample = WebBodyUtil.toBinaryMessage(request);
      sample.headers.forEach((v, k) => request.headers.set(k, Array.isArray(v) ? v.join(',') : v));
      request.body = WebBodyUtil.markRaw(await WebBodyUtil.toBuffer(sample.body!));
    }
    Object.assign(request.context, { httpQuery: BindUtil.flattenPaths(request.context.httpQuery ?? {}) });
    return request;
  }

  static async finalizeResponseBody(response: WebResponse, decompress?: boolean): Promise<WebResponse> {
    let result = response.body;

    response.context.httpStatusCode = WebCommonUtil.getStatusCode(response);

    if (decompress) {
      if (Buffer.isBuffer(result) || BinaryUtil.isReadable(result)) {
        const bufferResult = result = await WebBodyUtil.toBuffer(result);
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

  static async toFetchRequestInit(request: WebRequest): Promise<{ init: RequestInit, path: string }> {
    const { context: { httpQuery: query, httpMethod: method, path }, headers } = request;

    let q = '';
    if (query && Object.keys(query).length) {
      const pairs = Object.fromEntries(Object.entries(query).map(([k, v]) => [k, v === null || v === undefined ? '' : `${v}`] as const));
      q = `?${new URLSearchParams(pairs).toString()}`;
    }

    const finalPath = `${path}${q}`;

    const body: RequestInit['body'] =
      WebBodyUtil.isRaw(request.body) ?
        Buffer.isBuffer(request.body) ? request.body : await toBuffer(request.body) :
        castTo(request.body);

    return { path: finalPath, init: { headers, method, body } };
  }

  static async fromFetchResponse(response: Response): Promise<WebResponse> {
    return new WebResponse({
      body: Buffer.from(await response.arrayBuffer()),
      context: { httpStatusCode: response.status },
      headers: response.headers
    });
  }
}