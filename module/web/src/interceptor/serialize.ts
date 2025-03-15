import { pipeline } from 'node:stream/promises';

import { Inject, Injectable } from '@travetto/di';
import { AppError, hasFunction } from '@travetto/runtime';
import { Config } from '@travetto/config';

import { HttpSerializable } from '../response/serializable.ts';
import { HttpInterceptor, ManagedInterceptorConfig } from './types.ts';
import { FilterContext, FilterNext } from '../types.ts';
import { HttpPayloadUtil } from '../util/payload.ts';
import { WebSymbols } from '../symbols.ts';

const isSerializable = hasFunction<HttpSerializable>('serialize');

@Config('web.serialize')
class SerializeConfig extends ManagedInterceptorConfig {
  showStackTrace = true;
}

/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements HttpInterceptor<SerializeConfig> {

  @Inject()
  config: SerializeConfig;

  async intercept({ res, req }: FilterContext, next: FilterNext): Promise<unknown> {

    let value;

    try {
      value = await next();
      if (isSerializable(value)) {
        return await value.serialize(res);
      }
    } catch (error) {
      value = error instanceof Error ? error : AppError.fromBasic(error);

      if (this.config.showStackTrace) {
        console.error(value.message, { error: value });
      }
    }

    if (value && res.headersSent) {
      console.error('Failed to send, response already sent');
      return;
    }

    if (value) {
      const payload = HttpPayloadUtil.from(value);
      HttpPayloadUtil.applyPayload(payload, req, res);

      // Run any handlers if they exist
      for (const handler of res[WebSymbols.Internal].filters ?? []) {
        await handler(req, res);
      }

      const { body } = res[WebSymbols.Internal];
      if (Buffer.isBuffer(body) || body === undefined) {
        res.end(body);
      } else {
        await pipeline(body, res[WebSymbols.Internal].nodeEntity, { end: false });
        res.end();
      }
    }
  }
}