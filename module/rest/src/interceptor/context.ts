import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AsyncContext } from '@travetto/context';

import { Request, Response } from '../types';

import { RestInterceptor, DisabledConfig, PathAwareConfig } from './types';
import { GetCacheInterceptor } from './get-cache';
import { ConfiguredInterceptor } from './decorator';

@Config('rest.context')
class RestAsyncContextConfig implements DisabledConfig, PathAwareConfig {
  /**
   * Is interceptor disabled
   */
  disabled = false;
  /**
   * Path specific overrides
   */
  paths: string[] = [];
}

/**
 * Enables access to contextual data when running in a rest application
 */
@Injectable()
@ConfiguredInterceptor()
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