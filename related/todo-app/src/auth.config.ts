import { AuthenticationError, Authenticator, Principal } from '@travetto/auth';
import { InjectableFactory } from '@travetto/di';
import { SessionModelSymbol } from '@travetto/rest-session';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

export const BasicAuthSymbol = Symbol.for('AUTH_BASIC');

export type User = { username: string, password: string };

class AuthConfig {
  @InjectableFactory(SessionModelSymbol)
  static getSessionModel(): MemoryModelService {
    return new MemoryModelService(new MemoryModelConfig());
  }

  @InjectableFactory(BasicAuthSymbol)
  static getAuthenticator(): Authenticator<User> {
    return {
      authenticate(u): Principal {
        if (u.username && u.password === 'password') {
          return {
            issuer: 'self',
            id: u.username,
            permissions: [],
            details: {}
          };
        } else {
          throw new AuthenticationError('Unknown user');
        }
      }
    };
  }
}
