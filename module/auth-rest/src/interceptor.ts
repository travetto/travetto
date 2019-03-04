import { AppError } from '@travetto/base';
import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable, DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/registry';
import { AuthService } from '@travetto/auth';

import { ERR_INVALID_AUTH } from './errors';
import { IdentityProvider } from './provider';
import { AuthContextSerializer } from './serializer';

@Injectable()
export class AuthInterceptor extends RestInterceptor {

  private identityProviders = new Map<string, IdentityProvider>();

  constructor(
    private authService: AuthService,
    private serializer: AuthContextSerializer
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

  async restore(req: Request, res: Response): Promise<void> {
    const ctx = await this.serializer.deserialize(req, res);
    if (ctx) {
      this.authService.context = ctx;
    }
  }

  async updatePrincipalDetails(req: Request, res: Response, details: any) {
    await this.authService.updatePrincipalDetails(details);
  }

  intercept(req: Request, res: Response) {
    // tslint:disable-next-line: no-this-assignment
    const self = this;
    req.auth = {
      get principal() { return self.authService.principal; },
      logout: this.logout.bind(this, req, res),
      updatePrincipalDetails: this.updatePrincipalDetails.bind(this, req, res),
      authenticate: this.authenticate.bind(this, req, res)
    };
    return this.restore(req, res);
  }
}