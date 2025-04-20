import { Readable } from 'node:stream';
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

  static async applyRequestBody(req: WebRequest): Promise<WebRequest> {
    if (req.body !== undefined) {
      const sample = WebBodyUtil.toBinaryMessage(req);
      sample.headers.forEach((v, k) => req.headers.set(k, Array.isArray(v) ? v.join(',') : v));
      req.body = WebBodyUtil.markRaw(await WebBodyUtil.toBuffer(sample.body!));
    }
    Object.assign(req, { query: BindUtil.flattenPaths(req.context.httpQuery ?? {}) });
    return req;
  }

  static async finalizeResponseBody(res: WebResponse, decompress?: boolean): Promise<WebResponse> {
    let result = res.body;

    res.context.httpStatusCode = WebCommonUtil.getStatusCode(res);

    if (decompress) {
      if (Buffer.isBuffer(result) || BinaryUtil.isReadable(result)) {
        const bufferResult = result = await WebBodyUtil.toBuffer(result);
        if (bufferResult.length) {
          try {
            result = await toBuffer(DecompressInterceptor.decompress(
              res.headers,
              Readable.from(bufferResult),
              { applies: true, supportedEncodings: ['br', 'deflate', 'gzip', 'identity'] }
            ));
          } catch { }
        }
      }
    }

    const text = Buffer.isBuffer(result) ? result.toString('utf8') : (typeof result === 'string' ? result : undefined);

    if (text) {
      switch (res.headers.get('Content-Type')) {
        case 'application/json': result = JSON.parse(castTo(text)); break;
        case 'text/plain': result = text; break;
      }
    }

    if (res.context.httpStatusCode && res.context.httpStatusCode >= 400) {
      result = WebCommonUtil.catchResponse(AppError.fromJSON(result) ?? result).body;
    }

    res.body = result;
    return res;
  }
}