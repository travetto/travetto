import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AsyncContext, AsyncContextProp } from '@travetto/context';
import { Request, Response } from '@travetto/rest';

import { FilterContext, FilterNext } from '../types';

import { ManagedInterceptorConfig, RestInterceptor } from './types';
import { BodyParseInterceptor } from './body-parse';

@Config('rest.context')
class RestAsyncContextConfig extends ManagedInterceptorConfig { }

const REQUEST_SYMBOL = Symbol.for('@travetto/rest:request');
const RESPONSE_SYMBOL = Symbol.for('@travetto/rest:response');

/**
 * Enables access to contextual data when running in a rest application
 */
@Injectable()
export class AsyncContextInterceptor implements RestInterceptor {

  #reqProp: AsyncContextProp<Request>;
  #resProp: AsyncContextProp<Response>;

  dependsOn = [BodyParseInterceptor];

  @Inject()
  context: AsyncContext;

  @Inject()
  config: RestAsyncContextConfig;

  postConstruct(): void {
    this.#reqProp = this.context.prop(REQUEST_SYMBOL);
    this.#resProp = this.context.prop(RESPONSE_SYMBOL);
  }

  intercept(ctx: FilterContext, next: FilterNext): Promise<unknown> {
    return this.context.run(() => {
      this.#reqProp.set(ctx.req);
      this.#resProp.set(ctx.res);
      return next();
    });
  }

  get request(): Request {
    return this.#reqProp.get()!;
  }

  get response(): Response {
    return this.#resProp.get()!;
  }
}