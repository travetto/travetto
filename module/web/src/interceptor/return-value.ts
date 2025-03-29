import { Inject, Injectable } from '@travetto/di';

import { HttpInterceptor, HttpInterceptorCategory } from '../types/interceptor.ts';
import { HttpChainedContext } from '../types.ts';
import { HttpResponse } from '../types/response.ts';

@Injectable()
export class ReturnValueConfig {

  static finalizeConfig(base: ReturnValueConfig, inputs: Partial<ReturnValueConfig>[]): ReturnValueConfig {
    Object.assign(base.headers ??= {}, ...inputs.map(x => x.headers));
    return base;
  }

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
    return ReturnValueConfig.finalizeConfig(base, inputs);
  }

  async filter(ctx: HttpChainedContext<ReturnValueConfig>): Promise<HttpResponse> {
    const res = await ctx.next();
    const method = ctx.req.method.toUpperCase();

    res.headers.setFunctionalHeaders(ctx.config.headers);

    return res
      .ensureContentLength()
      .ensureContentType()
      .ensureStatusCode(method === 'POST' ? 201 : (method === 'PUT' ? 204 : 200));
  }
}