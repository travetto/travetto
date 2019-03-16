import { AppError } from '@travetto/base';
import { Request, Response } from '@travetto/rest';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { Class } from '@travetto/registry';
import { AuthContext, PrincipalProvider } from '@travetto/auth';
import { Context } from '@travetto/context';

import { ERR_INVALID_AUTH } from './errors';
import { IdentityProvider } from './identity';
import { AuthContextStore } from './context-store/types';

@Injectable()
export class AuthService {
  identityProviders = new Map<string, IdentityProvider>();

  @Inject()
  context?: Context;

  @Inject()
  authContextStore?: AuthContextStore;

  @Inject()
  principalProvider: PrincipalProvider;

  async postConstruct() {
    for (const provider of DependencyRegistry.getCandidateTypes(IdentityProvider as Class)) {
      const dep = await DependencyRegistry.getInstance(IdentityProvider, provider.qualifier);
      this.identityProviders.set(provider.qualifier.toString(), dep);
    }
  }

  setAuthContext(req: Request, ctx: AuthContext) {
    if (this.context) {
      this.context.set('auth', ctx);
    }
    req.__authContext = ctx;
  }

  async clearAuthContext(req: Request, res: Response) {
    if (this.context) {
      this.context.clear('auth');
    }
    delete req.__authContext;
  }

  async authenticate(req: Request, res: Response, identityProviders: symbol[]) {
    let lastError: Error | undefined;
    for (const provider of identityProviders) {
      try {
        const idp = this.identityProviders.get(provider.toString())!;
        const ident = await idp.authenticate(req, res);
        if (ident) { // Multi-step login process
          const ctx = await this.principalProvider.authorize(ident);
          this.setAuthContext(req, ctx);
          if (this.authContextStore) {
            await this.authContextStore.store(req, res, ctx);
          }
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

  async restore(req: Request) {
    if (this.authContextStore) {
      const ctx = await this.authContextStore.load(req);
      if (ctx) {
        this.setAuthContext(req, ctx);
      }
    }
  }

  async refresh(req: Request, res: Response) {
    if (this.authContextStore && this.authContextStore.refresh && req.__authContext) {
      this.authContextStore.refresh(req, res, req.__authContext);
    }
  }
}