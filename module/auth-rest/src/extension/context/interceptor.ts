// @line-if @travetto/context
import { AppError } from '@travetto/base';
import { Inject, Injectable } from '@travetto/di';
import { AsyncContext, AsyncContextInterceptor } from '@travetto/context';
import { Principal } from '@travetto/auth/src/types';
import { Request, Response, RestInterceptor } from '@travetto/rest';
import { AuthInterceptor } from '../../interceptor';

const PrincipalSym = Symbol.for('@trv:auth/principal');

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
  set(p: Principal | undefined) {
    this.context.set(PrincipalSym, p);
  }

  /**
   * Get the principal from the context
   * @returns principal if authenticated
   * @returns undefined if not authenticated
   */
  getOptional() {
    return this.context.get<Principal>(PrincipalSym);
  }

  /**
   * Get the principal from the context
   * @throws if not authenticated
   */
  get() {
    const p = this.getOptional();
    if (!p) {
      throw new AppError('Auth context is not present, please authenticate first', 'authentication');
    }
    return p;
  }
}

/**
 * Integration with the context service, to allow for tracking of
 * user principal through async calls.
 */
@Injectable()
export class AuthContextInterceptor implements RestInterceptor {

  after = [AuthInterceptor, AsyncContextInterceptor];

  @Inject()
  svc: AuthContextService;

  async intercept(req: Request, res: Response, next: () => Promise<unknown>) {
    try {
      this.svc.set(req.auth);
      return await next();
    } finally {
      this.svc.set(undefined);
    }
  }
}