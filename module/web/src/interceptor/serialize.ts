import { Injectable } from '@travetto/di';
import { AppError, hasFunction } from '@travetto/runtime';

import { HttpSerializable } from '../response/serializable.ts';
import { HttpInterceptor } from './types.ts';
import { FilterContext, FilterNext, HttpRequest, HttpResponse, WebInternal } from '../types.ts';
import { HttpPayloadUtil } from '../util/payload.ts';

const isSerializable = hasFunction<HttpSerializable>('serialize');

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements HttpInterceptor {

  async respond(req: HttpRequest, res: HttpResponse, value: unknown, applyFilters = true): Promise<void> {
    const payload = HttpPayloadUtil.from(value);
    HttpPayloadUtil.applyPayload(payload, req, res);

    if (res.headersSent) {
      console.error('Failed to send, response already sent');
      return;
    }

    if (applyFilters) {
      // Run any handlers if they exist
      for (const handler of res[WebInternal].filters ?? []) {
        await handler(req, res);
      }
    }
    await res.send(res[WebInternal].body);
  }

  async intercept({ res, req }: FilterContext, next: FilterNext): Promise<unknown> {
    try {
      const value = await next();
      if (isSerializable(value)) {
        return await value.serialize(res);
      }
      await this.respond(req, res, value);
    } catch (error) {
      await this.respond(req, res, error instanceof Error ? error : AppError.fromBasic(error), false);
    }
  }
}