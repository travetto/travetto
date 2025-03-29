import { Inject, Injectable } from '@travetto/di';

import { HttpInterceptor, HttpInterceptorCategory } from '../types/interceptor.ts';
import { HttpChainedContext } from '../types.ts';
import { HttpResponse } from '../types/response.ts';

@Injectable()
export class ReturnValueConfig {
  headers?: Record<string, string | (() => string)>;
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
    Object.assign(base.headers ??= {}, ...inputs.map(x => x.headers));
    return base;
  }

  async filter(ctx: HttpChainedContext<ReturnValueConfig>): Promise<HttpResponse> {
    const res = await ctx.next();
    const method = ctx.req.method.toUpperCase();

    for (const [k, v] of Object.entries(ctx.config.headers ?? {})) {
      res.headers.set(k, typeof v === 'function' ? v() : v);
    }

    return res
      .ensureContentLength()
      .ensureContentType()
      .ensureStatusCode(method === 'POST' ? 201 : (method === 'PUT' ? 204 : 200));
  }
}