import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AsyncContext, AsyncContextProp } from '@travetto/context';
import { Request, Response } from '@travetto/rest';

import { FilterContext, FilterNext } from '../types';

import { ManagedInterceptorConfig, RestInterceptor } from './types';
import { BodyParseInterceptor } from './body-parse';

@Config('rest.context')
class RestAsyncContextConfig extends ManagedInterceptorConfig { }

/**
 * Enables access to contextual data when running in a rest application
 */
@Injectable()
export class AsyncContextInterceptor implements RestInterceptor {

  #ctxProp: AsyncContextProp<FilterContext>;

  dependsOn = [BodyParseInterceptor];

  @Inject()
  context: AsyncContext;

  @Inject()
  config: RestAsyncContextConfig;

  postConstruct(): void {
    this.#ctxProp = this.context.prop();
  }

  intercept(ctx: FilterContext, next: FilterNext): Promise<unknown> {
    return this.context.run(() => {
      this.#ctxProp.set(ctx);
      return next();
    });
  }

  get request(): Request {
    return this.#ctxProp.get()?.req!;
  }

  get response(): Response {
    return this.#ctxProp.get()?.res!;
  }
}