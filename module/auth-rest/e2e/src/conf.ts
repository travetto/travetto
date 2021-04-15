import { } from '@travetto/auth';
import { Authenticator, Authorizer, Principal } from '@travetto/auth';
import { TimeUtil } from '@travetto/base/src/internal/time';
import { InjectableFactory } from '@travetto/di';

export class FbUser {
  id: string;
  roles: string[];
}

export const SIMPLE_AUTH = Symbol.for('simple-auth');

export class AppConfig {

  @InjectableFactory()
  static principalSource(): Authorizer {
    return new class implements Authorizer {
      authorize(p: Principal) { return p; }
    }();
  }

  @InjectableFactory(SIMPLE_AUTH)
  static facebookPassport(): Authenticator {
    return {
      async authenticate(user) {
        return {
          id: '5',
          expires: TimeUtil.withAge(1, 'm'),
          details: { woah: 'fun' },
          source: 'simple',
          permissions: []
        };
      }
    };
  }
}