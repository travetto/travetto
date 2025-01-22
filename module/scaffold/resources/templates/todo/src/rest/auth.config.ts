import { Authorizer, Authenticator, AuthenticationError, AuthenticatorContext } from '@travetto/auth';
import { SessionModelSymbol } from '@travetto/rest-session';
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
      authenticate({ input }: AuthenticatorContext<User>) {
        if (input.username && input.password === 'password') {
          return {
            issuer: 'self',
            id: input.username,
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
