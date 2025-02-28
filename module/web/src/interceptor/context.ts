import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AsyncContext, AsyncContextValue } from '@travetto/context';
import { HttpRequest, HttpResponse } from '@travetto/web';

import { FilterContext, FilterNext } from '../types';

import { ManagedInterceptorConfig, WebInterceptor } from './types';
import { BodyParseInterceptor } from './body-parse';

@Config('web.context')
class WebAsyncContextConfig extends ManagedInterceptorConfig { }

/**
 * Enables access to contextual data when running in a web application
 */
@Injectable()
export class AsyncContextInterceptor implements WebInterceptor {

  #active = new AsyncContextValue<FilterContext>(this);

  dependsOn = [BodyParseInterceptor];

  @Inject()
  context: AsyncContext;

  @Inject()
  config: WebAsyncContextConfig;

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