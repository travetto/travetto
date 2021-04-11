import { Authorizer, Authenticator, Principal } from '@travetto/auth';
import { InjectableFactory } from '@travetto/di';
import { AppError } from '@travetto/base';

export const BasicAuthSym = Symbol.for('AUTH_BASIC');

type User = { username: string; password: string };

class AuthConfig {
  @InjectableFactory()
  static getAuthorizer(): Authorizer { // Simply mirrors the identity back as the principal
    return { authorize: p => p };
  }

  @InjectableFactory(BasicAuthSym)
  static getAuthenticator(): Authenticator<User> {
    return {
      authenticate: u => {
        if (u.username && u.password === 'password') {
          return {
            issuer: 'self',
            id: u.username,
            permissions: [],
            details: {},
            source: 'insecure'
          };
        } else {
          throw new AppError('Unknown user', 'authentication');
        }
      }
    };
  }
}
