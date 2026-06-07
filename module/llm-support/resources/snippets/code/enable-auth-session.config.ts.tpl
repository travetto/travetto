import { type Authenticator, AuthenticationError, type Principal } from '@travetto/auth';
import { SessionModelSymbol } from '@travetto/auth-session';
import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

export const BasicAuthSymbol = Symbol.for('AUTH_BASIC');

type User = { username: string; password: string };

export class AuthConfig {

  @InjectableFactory(SessionModelSymbol)
  static getSessionModel(): MemoryModelService {
    return new MemoryModelService(new MemoryModelConfig());
  }

  @InjectableFactory(BasicAuthSymbol)
  static getAuthenticator(): Authenticator<User> {
    return {
      authenticate(user): Principal {
        if (user.username && user.password === 'password') {
          return {
            issuer: 'self',
            id: user.username,
            permissions: [],
            details: {},
            source: 'insecure'
          };
        }
        throw new AuthenticationError('Unknown user');
      }
    };
  }
}
