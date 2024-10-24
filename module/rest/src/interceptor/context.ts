import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AsyncContext } from '@travetto/context';

import { FilterContext, FilterNext, Request, Response } from '../types';

import { ManagedInterceptorConfig, RestInterceptor } from './types';
import { BodyParseInterceptor } from './body-parse';

@Config('rest.context')
class RestAsyncContextConfig extends ManagedInterceptorConfig { }

@Injectable()
export class RestAsyncContext {

  @Inject()
  ctx: AsyncContext;

  getRequest(): Request {
    return this.ctx.get<Request>('@travetto/rest:request');
  }

  getResponse(): Response {
    return this.ctx.get<Response>('@travetto/rest:response');
  }
}

/**
 * Enables access to contextual data when running in a rest application
 */
@Injectable()
export class AsyncContextInterceptor implements RestInterceptor {

  dependsOn = [BodyParseInterceptor];

  @Inject()
  context: AsyncContext;

  @Inject()
  config: RestAsyncContextConfig;

  intercept(ctx: FilterContext, next: FilterNext): Promise<unknown> {
    return this.context.run(() => {
      this.context.set('@travetto/rest:request', ctx.req);
      this.context.set('@travetto/rest:response', ctx.res);
      return next();
    });
  }
}