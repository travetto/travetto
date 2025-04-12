import { Readable } from 'node:stream';
import { buffer as toBuffer } from 'node:stream/consumers';
import { AppError, BinaryUtil, castTo } from '@travetto/runtime';
import { BindUtil } from '@travetto/schema';

import { WebResponse } from '../../src/types/response.ts';
import { WebRequest } from '../../src/types/request.ts';
import { DecompressInterceptor } from '../../src/interceptor/decompress.ts';
import { WebBodyUtil } from '../../src/util/body.ts';

export class WebTestDispatchUtil {

  static async applyRequestBody(req: WebRequest): Promise<WebRequest> {
    if (req.body !== undefined) {
      const sample = WebBodyUtil.toBinaryMessage(req);
      sample.headers.forEach((v, k) => req.headers.set(k, Array.isArray(v) ? v.join(',') : v));
      WebBodyUtil.setBodyUnprocessed(req, await WebBodyUtil.toBuffer(sample.body!));
    }
    Object.assign(req, { query: BindUtil.flattenPaths(req.query) });
    return req;
  }

  static async finalizeResponseBody(res: WebResponse, decompress?: boolean): Promise<WebResponse> {
    let result = res.body;

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
        case 'application/json': {
          try { result = JSON.parse(castTo(text)); } catch { }
          break;
        }
        case 'text/plain': result = text; break;
      }
    }

    if (res.statusCode && res.statusCode >= 400) {
      result = WebResponse.fromCatch(AppError.fromJSON(result) ?? result).body;
    }

    res.body = result;

    return res;
  }

  static returnResponse<T>(res: WebResponse, throwOnError: boolean): WebResponse<T> {
    if (throwOnError && res.body instanceof Error) {
      throw res.body;
    }

    return castTo(res);
  }
}