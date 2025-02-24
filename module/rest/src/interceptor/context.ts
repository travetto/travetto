import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AsyncContext, AsyncContextValue } from '@travetto/context';
import { Request, Response } from '@travetto/rest';

import { FilterContext, FilterNext } from '../types.ts';

import { ManagedInterceptorConfig, RestInterceptor } from './types.ts';
import { BodyParseInterceptor } from './body-parse.ts';

@Config('rest.context')
class RestAsyncContextConfig extends ManagedInterceptorConfig { }

/**
 * Enables access to contextual data when running in a rest application
 */
@Injectable()
export class AsyncContextInterceptor implements RestInterceptor {

  #active = new AsyncContextValue<FilterContext>(this);

  dependsOn = [BodyParseInterceptor];

  @Inject()
  context: AsyncContext;

  @Inject()
  config: RestAsyncContextConfig;

  intercept(ctx: FilterContext, next: FilterNext): Promise<unknown> {
    return this.context.run(() => {
      this.#active.set(ctx);
      return next();
    });
  }

  get request(): Request | undefined {
    return this.#active.get()?.req;
  }

  get response(): Response | undefined {
    return this.#active.get()?.res;
  }
}