import { Inject, Injectable } from '@travetto/di';
import { RestInterceptor, AsyncContextInterceptor, ManagedInterceptorConfig, FilterContext } from '@travetto/rest';
import { Config } from '@travetto/config';

import { AuthReadWriteInterceptor } from './read-write';
import { AuthService } from '../service';

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
  svc: AuthService;

  intercept({ req }: FilterContext): void {
    Object.defineProperty(req, 'auth', { get: () => this.svc.getPrincipal(), set: v => { this.svc.setPrincipal(v); } });
  }
}