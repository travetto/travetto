import { PrincipalSource, Identity } from '@travetto/auth';
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
    return new (class extends PrincipalSource {
      async resolvePrincipal(ident: Identity) {
        return ident;
      }
    })();
  }

  @InjectableFactory(SIMPLE_AUTH)
  static facebookPassport(): IdentitySource {
    return {
      async authenticate(req, res) {
        return {
          id: '5',
          expires: new Date(Date.now() + 1000 * 60),
          details: { woah: 'fun' },
          source: 'simple',
          permissions: []
        };
      }
    };
  }
}