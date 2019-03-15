import { AppError } from '@travetto/base';
import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable, DependencyRegistry, Inject } from '@travetto/di';
import { Class } from '@travetto/registry';
import { ContextInterceptor } from '@travetto/rest/extension/context';
import { AuthContext, PrincipalProvider } from '@travetto/auth';
import { Context } from '@travetto/context';

import { ERR_INVALID_AUTH } from './errors';
import { IdentityProvider } from './identity';
import { RestAuthContextSerializer } from './serializer/rest';

@Injectable()
export class AuthInterceptor extends RestInterceptor {

  private identityProviders = new Map<string, IdentityProvider>();

  after = ContextInterceptor;

  @Inject()
  context?: Context;

  @Inject()
  serializer?: RestAuthContextSerializer;

  constructor(
    private principalProvider: PrincipalProvider
  ) {
    super();
  }

  async postConstruct() {
    for (const provider of DependencyRegistry.getCandidateTypes(IdentityProvider as Class)) {
      const dep = await DependencyRegistry.getInstance(IdentityProvider, provider.qualifier);
      this.identityProviders.set(provider.qualifier.toString(), dep);
    }
  }

  setContext(req: Request, ctx: AuthContext) {
    if (this.context) {
      this.context.set('auth', ctx);
    }
    req.__authContext = ctx;
  }

  async authenticate(req: Request, res: Response, identityProviders: symbol[]) {
    let lastError: Error | undefined;
    for (const provider of identityProviders) {
      try {
        const idp = this.identityProviders.get(provider.toString())!;
        const ident = await idp.authenticate(req, res);
        if (ident) { // Multi-step login process
          const ctx = await this.principalProvider.authorize(ident);
          this.setContext(req, ctx);
          if (this.serializer) {
            await this.serializer.store(req, res, ctx);
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

  async logout(req: Request, res: Response) {
    if (this.context) {
      this.context.clear('auth');
    }
    delete req.__authContext;
  }

  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    if (this.serializer) {
      const ctx = await this.serializer.restore(req);
      if (ctx) {
        this.setContext(req, ctx);
      }
    }

    req.auth = {
      get principal() { return req.__authContext.principal; },
      get principalDetails() { return req.__authContext.principalDetails; },
      async updatePrincipalDetails(val: any) { req.__authContext.updatePrincipalDetails(val); },
      logout: this.logout.bind(this, req, res),
      authenticate: this.authenticate.bind(this, req, res)
    };

    const result = await next();

    if (this.serializer && this.serializer.refresh && req.__authContext) {
      this.serializer.refresh(req, res, req.__authContext);
    }

    return result;
  }
}