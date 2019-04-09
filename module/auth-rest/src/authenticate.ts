import { AppError } from '@travetto/base';
import { Request, Response } from '@travetto/rest';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { Class } from '@travetto/registry';
import { PrincipalProvider } from '@travetto/auth';

import { IdentityProvider } from './identity';

const ERR_INVALID_AUTH = 'Unable to authenticate';

@Injectable()
export class AuthenticationService {
  identityProviders = new Map<string, IdentityProvider>();

  @Inject()
  principalProvider: PrincipalProvider;

  async postConstruct() {
    for (const provider of DependencyRegistry.getCandidateTypes(IdentityProvider as Class<IdentityProvider>)) {
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
        return ident;
      } catch (e) {
        lastError = e;
      }
    }

    if (lastError) {
      console.error(lastError);
    }

    const err = new AppError(ERR_INVALID_AUTH, 'authentication');
    err.stack = (lastError ? lastError.stack : err.stack);
    throw err;
  }
}