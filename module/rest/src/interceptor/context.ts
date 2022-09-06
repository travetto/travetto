import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AsyncContext } from '@travetto/context';

import { Request, Response } from '../types';

import { RestInterceptor } from './types';
import { GetCacheInterceptor } from './get-cache';
import { ManagedConfig, ManagedInterceptor } from './decorator';

@Config('rest.context')
class RestAsyncContextConfig extends ManagedConfig { }

/**
 * Enables access to contextual data when running in a rest application
 */
@Injectable()
@ManagedInterceptor()
export class AsyncContextInterceptor implements RestInterceptor {

  after = [GetCacheInterceptor];

  @Inject()
  context: AsyncContext;

  @Inject()
  config: RestAsyncContextConfig;

  intercept(req: Request, res: Response, next: () => Promise<void>): Promise<void> {
    return this.context.run(next);
  }
}