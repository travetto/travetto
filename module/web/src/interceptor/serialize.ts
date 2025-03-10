import { Injectable } from '@travetto/di';
import { AppError, hasFunction } from '@travetto/runtime';
import { DataUtil } from '@travetto/schema';

import { HttpSerializable } from '../response/serializable';
import { HttpInterceptor } from './types';
import { FilterContext, FilterNext, HttpPayload, HttpResponse } from '../types';
import { HttpPayloadUtil } from '../util/payload';
import { WebSymbols } from '../symbols';

const isSerializable = hasFunction<HttpSerializable>('serialize');

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements HttpInterceptor {

  /**
   * Send response
   */
  async sendPayload(response: HttpResponse, basic: HttpPayload): Promise<void> {

    for (const map of [response[WebSymbols.Internal].headersAdded, basic?.headers]) {
      for (const [key, value] of Object.entries(map ?? {})) {
        response.setHeader(key, typeof value === 'function' ? value() : value);
      }
    }

    // Set header if not defined
    if (basic?.defaultContentType && !response.getHeader('content-type')) {
      response.setHeader('content-type', basic.defaultContentType);
    }

    response.statusCode = basic.statusCode ?? response.statusCode ?? 200;

    if (!basic.data) {
      response.send('');
    } else if (Buffer.isBuffer(basic.data) || typeof basic.data === 'string') {
      response.send(basic);
    } else {
      await response.sendStream(basic.data);
    }
  }

  async intercept({ res, req }: FilterContext, next: FilterNext): Promise<void> {
    let payload: HttpPayload | undefined;

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
      return console.error('Failed to send, already sent data');
    } else {
      if (payload.length === 0) { // On empty response
        res.statusCode ??= ((req.method === 'POST' || req.method === 'PUT') ? 201 : 204);
      }
      await this.sendPayload(res, payload);
    }
  }
}