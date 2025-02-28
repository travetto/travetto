import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AsyncContext, AsyncContextValue } from '@travetto/context';
import { HttpRequest, HttpResponse } from '@travetto/rest';

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

  get request(): HttpRequest | undefined {
    return this.#active.get()?.req;
  }

  get response(): HttpResponse | undefined {
    return this.#active.get()?.res;
  }
}