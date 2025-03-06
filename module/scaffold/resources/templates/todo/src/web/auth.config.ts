import { Authorizer, Authenticator, AuthenticationError } from '@travetto/auth';
import { SessionModelSymbol } from '@travetto/auth-session';
import { InjectableFactory } from '@travetto/di';
import { ModelExpirySupport } from '@travetto/model';
import { MemoryModelService } from '@travetto/model-memory';

export const BasicAuthSymbol = Symbol.for('AUTH_BASIC');

type User = { username: string, password: string };

class AuthConfig {
  @InjectableFactory()
  static getAuthorizer(): Authorizer { // Simply mirrors the identity back as the principal
    return { authorize: p => p };
  }

  @InjectableFactory(SessionModelSymbol)
  static getStore(svc: MemoryModelService): ModelExpirySupport {
    return svc;
  }

  @InjectableFactory(BasicAuthSymbol)
  static getAuthenticator(): Authenticator<User> {
    return {
      authenticate(u) {
        if (u.username && u.password === 'password') {
          return {
            issuer: 'self',
            id: u.username,
            permissions: [],
            details: {},
            source: 'insecure'
          };
        } else {
          throw new AuthenticationError('Unknown user');
        }
      }
    };
  }
}
