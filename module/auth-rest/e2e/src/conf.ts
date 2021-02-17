import { PrincipalSource, Identity } from '@travetto/auth';
import { AuthContext } from '@travetto/auth/src/context';
import { TimeUtil } from '@travetto/base/src/internal/time';
import { InjectableFactory } from '@travetto/di';

import { IdentitySource } from '../..';

export class FbUser {
  id: string;
  roles: string[];
}

export const SIMPLE_AUTH = Symbol.for('simple-auth');

export class AppConfig {

  @InjectableFactory()
  static principalSource(): PrincipalSource {
    return new class implements PrincipalSource {
      async authorize(ident: Identity) {
        return new AuthContext(ident, ident);
      }
    }();
  }

  @InjectableFactory(SIMPLE_AUTH)
  static facebookPassport(): IdentitySource {
    return {
      async authenticate(req, res) {
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