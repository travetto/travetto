import { AppError } from '@travetto/base';
import { Request, Response } from '@travetto/rest';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { Class } from '@travetto/registry';
import { AuthContext, PrincipalProvider } from '@travetto/auth';
import { Context } from '@travetto/context';

import { ERR_INVALID_AUTH } from './errors';
import { IdentityProvider } from './identity';

@Injectable()
export class AuthService {
  identityProviders = new Map<string, IdentityProvider>();

  @Inject()
  context?: Context;

  @Inject()
  principalProvider: PrincipalProvider;

  async postConstruct() {
    for (const provider of DependencyRegistry.getCandidateTypes(IdentityProvider as Class)) {
      const dep = await DependencyRegistry.getInstance(IdentityProvider, provider.qualifier);
      this.identityProviders.set(provider.qualifier.toString(), dep);
    }
  }

  getAuthContext(req?: Request) {
    if (req) {
      return req.session.context;
    } else if (this.context) {
      return this.context.get('auth') as AuthContext;
    } else {
      throw new AppError('No method available to find request, include @travetto/context to access the context outside of a request', 'notfound');
    }
  }

  setAuthContext(req: Request, res: Response, ctx: AuthContext) {
    if (ctx && ctx.constructor !== AuthContext) {
      ctx = new AuthContext(ctx.identity, ctx.principal);
    }
    if (this.context) {
      this.context.set('auth', ctx);
    }
    req.session.context = ctx;
  }

  async clearAuthContext(req: Request, res: Response) {
    if (this.context) {
      this.context.clear('auth');
    }
    delete req.session.context;
  }

  async authenticate(req: Request, res: Response, identityProviders: symbol[]) {
    let lastError: Error | undefined;
    for (const provider of identityProviders) {
      try {
        const idp = this.identityProviders.get(provider.toString())!;
        const ident = await idp.authenticate(req, res);
        if (ident) { // Multi-step login process
          const ctx = await this.principalProvider.authorize(ident);
          this.setAuthContext(req, res, ctx);
        }
        return ident;
      } catch (e) {
        lastError = e;
      }
    }

    const err = new AppError(ERR_INVALID_AUTH, 'authentication');
    err.stack = (lastError ? lastError.stack : err.stack);
    throw err;
  }

  async restore(req: Request, res: Response) {
    const ctx = req.session.context;
    if (ctx) {
      this.setAuthContext(req, res, ctx);
    }
  }
}