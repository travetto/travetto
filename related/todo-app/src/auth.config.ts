import { Authenticator, Principal } from '@travetto/auth';
import { InjectableFactory } from '@travetto/di';
import { AppError } from '@travetto/runtime';
import { SessionModelⲐ } from '@travetto/rest-session';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

export const BasicAuthⲐ = Symbol.for('AUTH_BASIC');

export type User = { username: string, password: string };

class AuthConfig {
  @InjectableFactory(SessionModelⲐ)
  static getSessionModel(): MemoryModelService {
    return new MemoryModelService(new MemoryModelConfig());
  }

  @InjectableFactory(BasicAuthⲐ)
  static getAuthenticator(): Authenticator<User> {
    return {
      authenticate: (u): Principal => {
        if (u.username && u.password === 'password') {
          return {
            issuer: 'self',
            id: u.username,
            permissions: [],
            details: {}
          };
        } else {
          throw new AppError('Unknown user', 'authentication');
        }
      }
    };
  }
}
