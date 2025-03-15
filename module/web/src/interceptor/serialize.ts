import { Inject, Injectable } from '@travetto/di';
import { AppError, hasFunction } from '@travetto/runtime';
import { Config } from '@travetto/config';

import { HttpSerializable } from '../response/serializable.ts';
import { HttpInterceptor, ManagedInterceptorConfig } from './types.ts';
import { FilterContext, FilterNext } from '../types.ts';
import { HttpPayloadUtil } from '../util/payload.ts';

const isSerializable = hasFunction<HttpSerializable>('serialize');

@Config('web.serialize')
class SerializeConfig extends ManagedInterceptorConfig {
  errorStackTrace = true;
}
/**
 * Serialization interceptor
 */
@Injectable()
export class SerializeInterceptor implements HttpInterceptor<SerializeConfig> {

  @Inject()
  config: SerializeConfig;

  async intercept({ res, req }: FilterContext, next: FilterNext): Promise<void> {
    let value;
    try {
      const output = await next();
      if (isSerializable(output)) {
        return await output.serialize(res);
      }
      value = output;
    } catch (error) {
      const resolved = error instanceof Error ? error : AppError.fromBasic(error);

      if (this.config.errorStackTrace) {
        console.error(resolved.message, { error: resolved });
      }
      value = resolved;
    }

    if (res.headersSent) {
      console.error('Failed to send, response already sent');
      return;
    }

    const payload = HttpPayloadUtil.from(value);
    HttpPayloadUtil.applyPayload(payload, req, res);
  }
}