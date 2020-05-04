import * as assert from 'assert';

import { AppError } from '@travetto/base';
import { Suite, Test } from '@travetto/test';

import { PrincipalSource } from '../src/principal';
import { Identity, Principal } from '../src/types';

const USERS: Record<string, Principal> = {
  a: {
    id: 'a',
    permissions: ['1', '2', '3'],
    details: {}
  }
};

class CustomSource extends PrincipalSource {
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
    const source = new CustomSource();
    await assert.rejects(() => source.authorize({
      id: 'b',
      details: {},
      permissions: ['1', '2'],
      source: 'none'
    }));

    await assert.doesNotReject(() => source.authorize({
      id: 'a',
      details: {},
      permissions: ['2', '3'],
      source: 'none'
    }));

    const ctx = await source.authorize({
      id: 'a',
      details: {},
      permissions: [],
      source: 'none'
    });

    assert(!!ctx.identity);
    assert(!!ctx.principal);
    assert(ctx.identity.id === ctx.principal.id);
    assert(ctx.identity.source === 'none');
    assert(ctx.principal.permissions === ['1', '2', '3']);
  }
}
