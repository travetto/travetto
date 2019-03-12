import { AppError } from '@travetto/base';
import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable, DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/registry';
import { AuthService } from '@travetto/auth';
import { ContextInterceptor } from '@travetto/rest/extension/context';

import { ERR_INVALID_AUTH } from './errors';
import { IdentityProvider } from './identity';
import { RestAuthContextSerializer } from './serializer/rest';

@Injectable()
export class AuthInterceptor extends RestInterceptor {

  private identityProviders = new Map<string, IdentityProvider>();

  after = ContextInterceptor;

  constructor(
    private authService: AuthService,
    private serializer: RestAuthContextSerializer
  ) {
    super();
  }

  async postConstruct() {
    for (const provider of DependencyRegistry.getCandidateTypes(IdentityProvider as Class)) {
      const dep = await DependencyRegistry.getInstance(IdentityProvider, provider.qualifier);
      this.identityProviders.set(provider.qualifier.toString(), dep);
    }
  }

  async authenticate(req: Request, res: Response, identityProviders: symbol[]) {
    let lastError: Error | undefined;
    for (const provider of identityProviders) {
      try {
        const idp = this.identityProviders.get(provider.toString())!;
        const ident = await idp.authenticate(req, res);
        if (ident) { // Multi-step login process
          await this.authService.authorize(ident);
          await this.serializer.store(req, res, this.authService.context);
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
    await this.authService.logout();
  }

  async updatePrincipalDetails(req: Request, res: Response, details: any) {
    await this.authService.updatePrincipalDetails(details);
  }

  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    // tslint:disable-next-line: no-this-assignment
    const self = this;
    req.auth = {
      get principal() { return self.authService.principal; },
      logout: this.logout.bind(this, req, res),
      updatePrincipalDetails: this.updatePrincipalDetails.bind(this, req, res),
      authenticate: this.authenticate.bind(this, req, res)
    };

    const ctx = await this.serializer.restore(req);
    if (ctx) {
      this.authService.context = ctx;
    }

    await next();

    if (this.serializer.refresh && this.authService.context) {
      this.serializer.refresh(req, res, this.authService.context);
    }
  }
}