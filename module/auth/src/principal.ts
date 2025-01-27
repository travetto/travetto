import { InjectableFactory } from '@travetto/di';
import { AuthContext } from './context';
import { Principal } from './types/principal';

class Injectables {
  @InjectableFactory()
  static getPrincipal(auth: AuthContext): Principal {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return new Proxy<Principal>({} as Principal, {
      get(target, p, receiver): unknown {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return auth.principal?.[p as keyof Principal];
      },
    });
  }
}