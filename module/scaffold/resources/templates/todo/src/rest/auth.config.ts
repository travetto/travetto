import { Authorizer, Authenticator } from '@travetto/auth';
import { SessionModelⲐ } from '@travetto/rest-session';
import { InjectableFactory } from '@travetto/di';
import { AppError } from '@travetto/runtime';
import { ModelExpirySupport } from '@travetto/model';
import { MemoryModelService } from '@travetto/model-memory';

export const BasicAuthⲐ = Symbol.for('AUTH_BASIC');

type User = { username: string, password: string };

class AuthConfig {
  @InjectableFactory()
  static getAuthorizer(): Authorizer { // Simply mirrors the identity back as the principal
    return { authorize: p => p };
  }

  @InjectableFactory(SessionModelⲐ)
  static getStore(svc: MemoryModelService): ModelExpirySupport {
    return svc;
  }

  @InjectableFactory(BasicAuthⲐ)
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
          throw new AppError('Unknown user', 'authentication');
        }
      }
    };
  }
}
