import { PrincipalSource, Identity, AuthContext } from '@travetto/auth';
import { IdentitySource } from '@travetto/auth-rest';
import { InjectableFactory } from '@travetto/di';
import { Request, Response } from '@travetto/rest';
import { AppError } from '@travetto/base';

export const BasicAuthSym = Symbol.for('AUTH_BASIC');

class AuthConfig {
  @InjectableFactory()
  static getPrincipalSource(): PrincipalSource { // Simply mirrors the identity back as the principal
    return {
      async authorize(ident: Identity) {
        return new AuthContext(ident);
      }
    };
  }

  @InjectableFactory(BasicAuthSym)
  static getIdentitySource(): IdentitySource {
    return {
      async authenticate(req: Request, res: Response) {
        const obj = req.body && req.body.username ? req.body : req.params;

        if (obj.username && obj.password === 'password') {
          return {
            issuer: 'self',
            id: obj.username,
            permissions: [],
            details: {},
            source: 'insecure'
          } as Identity;
        } else {
          throw new AppError('Unknown user', 'authentication');
        }
      }
    };
  }
}
