import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AsyncContext } from '@travetto/context';

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

  dependsOn = [BodyParseInterceptor];

  @Inject()
  context: AsyncContext;

  @Inject()
  config: RestAsyncContextConfig;

  intercept(ctx: FilterContext, next: FilterNext): Promise<unknown> {
    return this.context.run(next);
  }
}