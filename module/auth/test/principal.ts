import * as assert from 'assert';

import { AppError } from '@travetto/base';
import { Suite, Test } from '@travetto/test';

import { PrincipalSource, Identity, Principal } from '../src/types';
import { AuthContext } from '../src/context';

const USERS: Record<string, Principal> = {
  a: {
    id: 'a',
    permissions: ['1', '2', '3'],
    details: {}
  }
};

class CustomSource implements PrincipalSource {
  async resolvePrincipal(ident: Identity): Promise<Principal> {
    if (!(ident.id in USERS)) {
      throw new AppError('User is not found', 'notfound');
    }
    return USERS[ident.id];
  }
  async authorize(ident: Identity) {
    return new AuthContext(ident, await this.resolvePrincipal(ident));
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
      issuer: 'none'
    }));

    await assert.doesNotReject(() => source.authorize({
      id: 'a',
      details: {},
      permissions: ['2', '3'],
      issuer: 'none'
    }));

    const ctx = await source.authorize({
      id: 'a',
      details: {},
      permissions: [],
      issuer: 'none'
    });

    assert(!!ctx.identity);
    assert(!!ctx.principal);
    assert(ctx.identity.id === ctx.principal.id);
    assert(ctx.identity.issuer === 'none');
    assert(ctx.principal.permissions === ['1', '2', '3']);
  }
}
