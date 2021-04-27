import { Authenticator } from '@travetto/auth';
import { InjectableFactory } from '@travetto/di';
import { AppError } from '@travetto/base';
import { SessionModelⲐ } from '@travetto/rest-session';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model';

export const BasicAuthⲐ = Symbol.for('AUTH_BASIC');

type User = { username: string, password: string };

class AuthConfig {
  @InjectableFactory(SessionModelⲐ)
  static getSessionModel() {
    return new MemoryModelService(new MemoryModelConfig());
  }

  @InjectableFactory(BasicAuthⲐ)
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
