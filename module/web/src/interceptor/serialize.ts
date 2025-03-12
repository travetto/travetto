import { Inject, Injectable } from '@travetto/di';
import { AppError, hasFunction } from '@travetto/runtime';
import { DataUtil } from '@travetto/schema';
import { Config } from '@travetto/config';

import { HttpSerializable } from '../response/serializable';
import { HttpInterceptor, ManagedInterceptorConfig } from './types';
import { FilterContext, FilterNext, HttpPayload, HttpRequest, HttpResponse } from '../types';
import { HttpPayloadUtil } from '../util/payload';
import { WebSymbols } from '../symbols';

const isSerializable = hasFunction<HttpSerializable>('serialize');
const NO_TRANSFORM_REGEX = /(?:^|,)\s*?no-transform\s*?(?:,|$)/;

type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

@Config('web.compress')
class CompressConfig {
  /**
   * zlib chunk size
   */
  chunkSize = 2 ** 14;

  /**
   * zlib compression Level
   */
  level?: Digit | -1 | 0 = -1;

  /**
   * zlib memory usage
   */
  memLevel?: Digit = 8;

  /**
   * Limit before sending bytes
   */
  threshold = 2 ** 10;

  /**
   * The size of the memory window in bits for compressing
   */
  windowBits = 15;
}

@Config('web.serialize')
class SerializeConfig extends ManagedInterceptorConfig {
  compress = true;
}

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements HttpInterceptor<SerializeConfig> {

  @Inject()
  config: SerializeConfig;

  @Inject()
  compress: CompressConfig;

  #shouldCompress(req: HttpRequest, res: HttpResponse, basic: HttpPayload): boolean {
    return this.config.compress &&
      basic.length! > this.compress.threshold &&
      req.method !== 'HEAD' &&
      !res.getHeader('content-encoding') &&
      !NO_TRANSFORM_REGEX.test(res.getHeader('cache-control')?.toString() ?? '');
  }

  /**
   * Send response
   */
  async sendPayload(req: HttpRequest, res: HttpResponse, basic: HttpPayload): Promise<void> {
    for (const map of [res[WebSymbols.Internal].headersAdded, basic?.headers]) {
      for (const [key, value] of Object.entries(map ?? {})) {
        res.setHeader(key, typeof value === 'function' ? value() : value);
      }
    }

    // Set header if not defined
    if (!res.getHeader('content-type')) {
      res.setHeader('content-type', basic.defaultContentType ?? 'application/octet-stream');
    }

    // Set length if provided
    if (basic.length) {
      res.setHeader('content-length', `${basic.length}`);
    }

    // Set response code if not defined
    if (!basic.statusCode) {
      if (basic.length === 0) {  // On empty response
        basic.statusCode = (req.method === 'POST' || req.method === 'PUT') ? 201 : 204;
      } else {
        basic.statusCode = 200;
      }
    }

    // Defer to preset status code if already done
    res.statusCode ??= basic.statusCode;

    if (this.#shouldCompress(req, res, basic)) {
      // We need to compress
    }

    if (Buffer.isBuffer(basic.data)) {
      res.send(basic);
    } else {
      await res.sendStream(basic.data);
    }
  }

  async intercept({ res, req }: FilterContext, next: FilterNext): Promise<void> {
    let payload: HttpPayload | void;

    try {
      const output = await next();
      payload = isSerializable(output) ? await output.serialize(res) : HttpPayloadUtil.toPayload(output);
    } catch (error) {
      const resolved = error instanceof Error ? error :
        !DataUtil.isPlainObject(error) ? new AppError(`${error}`) :
          new AppError(`${error['message'] || 'Unexpected error'}`, { details: error });

      console.error(resolved.message, { error: resolved });
      payload = HttpPayloadUtil.fromError(resolved);
    }

    if (!payload) {
      return; // Nothing to return
    } else if (res.headersSent) {
      return console.error('Failed to send, response already sent');
    }

    await this.sendPayload(req, res, payload);
  }
}