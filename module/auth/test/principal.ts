import * as assert from 'assert';

import { AppError } from '@travetto/base';
import { Suite, Test } from '@travetto/test';

import { PrincipalProvider } from '../src/principal';
import { Identity, Principal } from '../src/types';

const USERS: Record<string, Principal> = {
  a: {
    id: 'a',
    permissions: ['1', '2', '3'],
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
    const principalProvider = new CustomPP();
    await assert.rejects(() => principalProvider.authorize({
      id: 'b',
      details: {},
      permissions: ['1', '2'],
      provider: 'none'
    }));

    await assert.doesNotReject(() => principalProvider.authorize({
      id: 'a',
      details: {},
      permissions: ['2', '3'],
      provider: 'none'
    }));

    const ctx = await principalProvider.authorize({
      id: 'a',
      details: {},
      permissions: [],
      provider: 'none'
    });

    assert(!!ctx.identity);
    assert(!!ctx.principal);
    assert(ctx.identity.id === ctx.principal.id);
    assert(ctx.identity.provider === 'none');
    assert(ctx.principal.permissions === ['1', '2', '3']);
  }
}
