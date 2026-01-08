import { AuthenticationError, type Authenticator, type Principal } from '@travetto/auth';
import { InjectableFactory } from '@travetto/di';
import { SessionModelSymbol } from '@travetto/auth-session';
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
      authenticate: (user): Principal => {
        if (user.username && user.password === 'password') {
          return {
            issuer: 'self',
            id: user.username,
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
