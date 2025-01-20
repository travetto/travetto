import { Inject, Injectable } from '@travetto/di';
import { AuthContextService } from '@travetto/auth';
import { RestInterceptor, AsyncContextInterceptor, ManagedInterceptorConfig, FilterContext } from '@travetto/rest';
import { Config } from '@travetto/config';

import { AuthReadWriteInterceptor } from './read-write';

@Config('rest.auth.context')
export class RestAuthContextConfig extends ManagedInterceptorConfig { }

/**
 * Integration with the context service, to allow for tracking of
 * user principal through async calls.
 */
@Injectable()
export class AuthContextInterceptor implements RestInterceptor {

  dependsOn = [AsyncContextInterceptor];
  runsBefore = [AuthReadWriteInterceptor];

  @Inject()
  config: RestAuthContextConfig;

  @Inject()
  svc: AuthContextService;

  intercept({ req }: FilterContext): void {
    Object.defineProperty(req, 'auth', { get: () => this.svc.getPrincipal(), set: v => { this.svc.setPrincipal(v); } });
  }
}