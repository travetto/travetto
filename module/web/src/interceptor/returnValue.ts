import { Inject, Injectable } from '@travetto/di';

import { HttpInterceptor, HttpInterceptorCategory } from '../types/interceptor.ts';
import { HttpChainedContext } from '../types.ts';
import { HttpResponse } from '../types/response.ts';
import { HttpHeaderMap } from '../types/headers.ts';

@Injectable()
class ReturnValueConfig {
  headers: HttpHeaderMap = {};
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

  async filter(ctx: HttpChainedContext<ReturnValueConfig>): Promise<HttpResponse> {
    const res = await ctx.next();
    const method = ctx.req.method.toUpperCase();

    res.headers.setAll(ctx.config.headers, true);

    return res
      .ensureContentLength()
      .ensureContentType()
      .ensureStatusCode(method === 'POST' ? 201 : (method === 'PUT' ? 204 : 200));
  }
}