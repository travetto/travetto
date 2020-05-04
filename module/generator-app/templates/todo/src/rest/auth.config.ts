import { PrincipalSource, Identity } from '@travetto/auth';
import { IdentitySource } from '@travetto/auth-rest';
import { InjectableFactory } from '@travetto/di';
import { Request, Response } from '@travetto/rest';
import { AppError } from '@travetto/base';

export const BASIC = Symbol('BASIC');

class AuthConfig {
  @InjectableFactory()
  static getPrincipalSource(): PrincipalSource { // Simply mirrors the identity back as the principal
    return new class extends PrincipalSource {
      async resolvePrincipal(ident: Identity) {
        return ident;
      }
    }();
  }

  @InjectableFactory(BASIC)
  static getIdentitySource(): IdentitySource {
    return new class extends IdentitySource {
      async authenticate(req: Request, res: Response) {
        const obj = req.body && req.body.username ? req.body : req.params;

        if (obj.username && obj.password === 'password') {
          return {
            id: obj.username,
            permissions: [],
            details: {},
            source: 'insecure'
          } as Identity;
        } else {
          throw new AppError('Unknown user', 'authentication');
        }
      }
    }();
  }
}
