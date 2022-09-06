import { Inject, Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { Principal } from '@travetto/auth';
import { Request, Response, RestInterceptor, AsyncContextInterceptor, ManagedConfig, ManagedInterceptor } from '@travetto/rest';
import { AuthInterceptor } from '@travetto/auth-rest';
import { Config } from '@travetto/config';

const PrincipalⲐ = Symbol.for('@trv:auth/principal');

@Config('rest.authContext')
export class RestAuthContextConfig extends ManagedConfig { }

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
@ManagedInterceptor()
export class AuthContextInterceptor implements RestInterceptor {

  after = [AsyncContextInterceptor];
  before = [AuthInterceptor];

  @Inject()
  config: RestAuthContextConfig;

  @Inject()
  svc: AuthContextService;

  intercept(req: Request, res: Response): void {
    Object.defineProperty(req, 'auth', { get: this.svc.get, set: this.svc.set });
  }
}