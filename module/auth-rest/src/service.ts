import { AppError } from '@travetto/base';
import { Request, Response } from '@travetto/rest';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { Class } from '@travetto/registry';
import { PrincipalProvider } from '@travetto/auth';
import { Context } from '@travetto/context';

import { IdentityProvider } from './identity';

const ERR_INVALID_AUTH = 'Unable to authenticate';
const REQ_SYM = Symbol('trv_req');

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

  registerContext(req: Request) {
    if (this.context) {
      this.context.set(REQ_SYM, req);
    }
  }

  getAuthContext() {
    if (this.context) {
      const ctx = this.context.get(REQ_SYM) as Request;
      if (!ctx) {
        throw new AppError('Auth context is not present, please authenticate first', 'authentication');
      }
      return ctx.auth;
    } else {
      throw new AppError('Cannot retrieve information without request unless @travetto/context is installed', 'notfound');
    }
  }

  async authenticate(req: Request, res: Response, identityProviders: symbol[]) {
    let lastError: Error | undefined;
    for (const provider of identityProviders) {
      try {
        const idp = this.identityProviders.get(provider.toString())!;
        const ident = await idp.authenticate(req, res);
        if (ident) { // Multi-step login process
          req.auth = await this.principalProvider.authorize(ident);
        }
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