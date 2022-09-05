// @file-if @travetto/context
import { Inject, Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { AsyncContextInterceptor } from '@travetto/rest/src/extension/context';
import { Principal } from '@travetto/auth';
import { Request, Response, RestInterceptor } from '@travetto/rest';

import { AuthInterceptor } from '../../interceptor';

const PrincipalⲐ = Symbol.for('@trv:auth/principal');

/**
 * Provides global context to accessing principal
 */
@Injectable()
export class AuthContextService {
  @Inject()
  context: AsyncContext;

  /**
   * Set principal
   * @param p The auth principal
   */
  set = (p: Principal | undefined): void => this.context.set(PrincipalⲐ, p);

  /**
   * Get the principal from the context
   * @returns principal if authenticated
   * @returns undefined if not authenticated
   */
  get = (): (Principal | undefined) => this.context.get<Principal>(PrincipalⲐ);
}

/**
 * Integration with the context service, to allow for tracking of
 * user principal through async calls.
 */
@Injectable()
export class AuthContextInterceptor implements RestInterceptor {

  after = [AsyncContextInterceptor];
  before = [AuthInterceptor];

  @Inject()
  svc: AuthContextService;

  intercept(req: Request, res: Response): void {
    Object.defineProperty(req, 'auth', { get: this.svc.get, set: this.svc.set });
  }
}