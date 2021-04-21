import { Authorizer, Authenticator, Principal } from '@travetto/auth';
import { InjectableFactory } from '@travetto/di';
import { AppError } from '@travetto/base';
import { SessionModelSym } from '@travetto/rest-session';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model';

export const BasicAuthSym = Symbol.for('AUTH_BASIC');

type User = { username: string; password: string };

class AuthConfig {
  @InjectableFactory(SessionModelSym)
  static getSessionModel() {
    return new MemoryModelService(new MemoryModelConfig());
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
