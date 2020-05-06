import { AppError } from '@travetto/base';
import { Request, ContextProvider } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';
import { AuthContext } from '@travetto/auth';
import { AsyncContext } from '@travetto/context';

const CTX_SYM = Symbol.for('trv_ctx');

/**
 * Integration with the context service, to allow for tracking of
 * user state through async calls.
 */
@Injectable()
@ContextProvider(AuthContext, (c, req) => req!.auth)
export class AuthContextService {

  @Inject()
  context?: AsyncContext;

  /**
   * Set auth context
   */
  set(ctx: AuthContext, req?: Request) {
    if (this.context) {
      this.context.set(CTX_SYM, ctx);
    }
    if (req) {
      req.auth = ctx;
    }
    if (!req && !this.context) {
      throw new AppError('Cannot set information without request unless @travetto/context is installed or a request is passed in', 'notfound');
    }
  }

  /**
   * Get the context from the request
   */
  get(req?: Request) {
    if (req) {
      return req.auth;
    } else if (this.context) {
      const ctx = this.context.get<AuthContext>(CTX_SYM);
      if (!ctx) {
        throw new AppError('Auth context is not present, please authenticate first', 'authentication');
      }
      return ctx;
    } else {
      throw new AppError('Cannot retrieve information without request unless @travetto/context is installed', 'notfound');
    }
  }

  /**
   * Get the auth/principal id
   */
  getId(req?: Request) {
    return this.get(req).id;
  }

  /**
   * Clear the context
   */
  clear(req?: Request) {
    if (this.context) {
      this.context.clear(CTX_SYM);
    }
    if (req) {
      delete req.auth;
    }
  }
}