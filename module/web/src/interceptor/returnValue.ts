import { Inject, Injectable } from '@travetto/di';

import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';
import { HttpChainedContext } from '../types.ts';
import { HttpPayload } from '../response/payload.ts';

@Injectable()
class ReturnValueConfig {
  headers: Record<string, string | (() => string)> = {};
}

@Injectable()
export class ReturnValueInterceptor implements HttpInterceptor<ReturnValueConfig> {

  @Inject()
  config: ReturnValueConfig;

  category: HttpInterceptorCategory = 'value';

  /**
   * Produces final config object
   */
  finalizeConfig(base: ReturnValueConfig, inputs: Partial<ReturnValueConfig>[]): ReturnValueConfig {
    base.headers ??= {};
    for (const v of inputs) {
      Object.assign(base.headers, v.headers);
    }
    return base;
  }

  async filter(ctx: HttpChainedContext<ReturnValueConfig>): Promise<HttpPayload> {
    const payload = await ctx.next();
    const method = ctx.req.method.toUpperCase();

    for (const [k, v] of Object.entries(ctx.config.headers)) {
      if (!payload.hasHeader(k)) {
        payload.setHeader(k, v);
      }
    }

    return payload
      .ensureContentLength()
      .ensureContentType()
      .ensureStatusCode(method === 'POST' ? 201 : (method === 'PUT' ? 204 : 200));
  }
}