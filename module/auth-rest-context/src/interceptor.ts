import { Inject, Injectable } from '@travetto/di';
import { RestInterceptor, AsyncContextInterceptor, ManagedInterceptorConfig, FilterContext } from '@travetto/rest';
import { AuthReadWriteInterceptor } from '@travetto/auth-rest';
import { Config } from '@travetto/config';

import { AuthContextService } from './service';

@Config('rest.auth.context')
export class RestAuthContextConfig extends ManagedInterceptorConfig { }

/**
 * Integration with the context service, to allow for tracking of
 * user principal through async calls.
 */
@Injectable()
export class AuthContextInterceptor implements RestInterceptor {

  after = [AsyncContextInterceptor];
  before = [AuthReadWriteInterceptor];

  @Inject()
  config: RestAuthContextConfig;

  @Inject()
  svc: AuthContextService;

  intercept({ req }: FilterContext): void {
    Object.defineProperty(req, 'auth', { get: this.svc.get, set: this.svc.set });
  }
}