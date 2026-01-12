import { type Authorizer, type Authenticator, AuthenticationError } from '@travetto/auth';
import { SessionModelSymbol } from '@travetto/auth-session';
import { InjectableFactory } from '@travetto/di';
import type { ModelExpirySupport } from '@travetto/model';
import type { MemoryModelService } from '@travetto/model-memory';

export const BasicAuthSymbol = Symbol.for('AUTH_BASIC');

type User = { username: string, password: string };

class AuthConfig {
  @InjectableFactory()
  static getAuthorizer(): Authorizer { // Simply mirrors the identity back as the principal
    return { authorize: principal => principal };
  }

  @InjectableFactory(SessionModelSymbol)
  static getStore(service: MemoryModelService): ModelExpirySupport {
    return service;
  }

  @InjectableFactory(BasicAuthSymbol)
  static getAuthenticator(): Authenticator<User> {
    return {
      authenticate(user) {
        if (user.username && user.password === 'password') {
          return {
            issuer: 'self',
            id: user.username,
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
