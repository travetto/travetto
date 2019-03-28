import { PrincipalProvider, Identity } from '@travetto/auth';
import { IdentityProvider } from '@travetto/auth-rest';
import { InjectableFactory } from '@travetto/di';
import { Request, Response } from '@travetto/rest';
import { AppError } from '@travetto/base';

export const BASIC = Symbol('BASIC');

class AuthConfig {
  @InjectableFactory()
  static getPrincipalProvider(): PrincipalProvider { // Simply mirrors the identity back as the principal
    return new class extends PrincipalProvider {
      async resolvePrincipal(ident: Identity) {
        return ident;
      }
    }();
  }

  @InjectableFactory(BASIC)
  static getIdentityProvider(): IdentityProvider {
    return new class extends IdentityProvider {
      async authenticate(req: Request, res: Response) {
        const obj = req.body && req.body.username ? req.body : req.params;

        if (obj.username && obj.password === 'password') {
          return {
            id: obj.username,
            permissions: [],
            details: {},
            provider: 'insecure'
          } as Identity;
        } else {
          throw new AppError('Unknown user', 'authentication');
        }
      }
    }();
  }
}
