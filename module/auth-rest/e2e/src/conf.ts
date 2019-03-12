import { PrincipalProvider, Identity } from '@travetto/auth';
import { InjectableFactory } from '@travetto/di';

import { IdentityProvider, SessionAuthContextSerializer, RestAuthContextSerializer } from '../..';

export class FbUser {
  id: string;
  roles: string[];
}

export const SIMPLE_AUTH = Symbol('simple-auth');

export class AppConfig {
  @InjectableFactory()
  static serializer(): RestAuthContextSerializer {
    return new SessionAuthContextSerializer({});
  }

  @InjectableFactory()
  static provider(): PrincipalProvider {
    return new (class extends PrincipalProvider {
      async resolvePrincipal(ident: Identity) {
        return ident;
      }
    })();
  }

  @InjectableFactory(SIMPLE_AUTH)
  static facebookPassport(): IdentityProvider {
    return {
      async authenticate(req, res) {
        return {
          id: '5',
          expires: new Date(Date.now() + 1000 * 60),
          details: { woah: 'fun' },
          provider: 'simple',
          permissions: new Set<string>()
        };
      }
    };
  }
}