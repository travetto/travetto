import * as assert from 'assert';

import { AppError } from '@travetto/base';
import { Suite, Test } from '@travetto/test';
import { Context } from '@travetto/context';

import { AuthService } from '../src/service';
import { PrincipalProvider } from '../src/principal';
import { Identity, Principal } from '../src/types';

const USERS: { [key: string]: Principal } = {
  a: {
    id: 'a',
    permissions: new Set(['1', '2', '3']),
    details: {}
  }
};

class CustomPP extends PrincipalProvider {
  async resolvePrincipal(ident: Identity): Promise<Principal> {
    if (!(ident.id in USERS)) {
      throw new AppError('User is not found', 'notfound');
    }
    return USERS[ident.id];
  }
}

@Suite()
export class PrincipalTest {

  @Test()
  async verifyTypings() {
    const service = new AuthService();
    service.contextProvider = new Context();
    service.principalProvider = new CustomPP();
    await service.contextProvider.run(async () => {
      await assert.rejects(() => service.authorize({
        id: 'b',
        details: {},
        permissions: new Set(['1', '2']),
        provider: 'none'
      }));

      await assert.doesNotReject(() => service.authorize({
        id: 'a',
        details: {},
        permissions: new Set(['2', '3']),
        provider: 'none'
      }));

      const ctx = await service.authorize({
        id: 'a',
        details: {},
        permissions: new Set(),
        provider: 'none'
      });

      assert(!!ctx.identity);
      assert(!!ctx.principal);
      assert(ctx.identity.id === ctx.principal.id);
      assert(ctx.identity.provider === 'none');
      assert(ctx.principal.permissions === new Set(['1', '2', '3']));
    });
  }
}
