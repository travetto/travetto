import { pipeline } from 'node:stream/promises';

import { Inject, Injectable } from '@travetto/di';
import { AppError } from '@travetto/runtime';
import { Config } from '@travetto/config';

import { HttpInterceptor, ManagedInterceptorConfig } from './types.ts';
import { FilterContext, FilterNext } from '../types.ts';
import { HttpPayloadUtil } from '../util/payload.ts';
import { WebSymbols } from '../symbols.ts';

@Config('web.global')
class GlobalConfig extends ManagedInterceptorConfig {
  showStackTrace = true;
}
/**
 * Global handler interceptor
 */
@Injectable()
export class GlobalInterceptor implements HttpInterceptor<GlobalConfig> {

  @Inject()
  config: GlobalConfig;

  async intercept({ res, req }: FilterContext, next: FilterNext): Promise<unknown> {
    try {
      await next();
    } catch (error) {
      const resolved = error instanceof Error ? error : AppError.fromBasic(error);

      if (this.config.showStackTrace) {
        console.error(resolved.message, { error: resolved });
      }

      const payload = HttpPayloadUtil.fromError(resolved);
      HttpPayloadUtil.applyPayload(payload, req, res);
    }

    // Dispatch body on final boundary
    const { body } = res[WebSymbols.Internal];

    if (body !== undefined) {
      if (res.headersSent) {
        console.error('Failed to send, response already sent');
        return;
      }

      if (Buffer.isBuffer(body) || body === undefined) {
        res.end(body);
      } else {
        await pipeline(body, res[WebSymbols.Internal].nodeEntity, { end: false });
        res.end();
      }
    }
  }
}