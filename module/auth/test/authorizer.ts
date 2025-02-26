import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { Authorizer } from '../src/types/authorizer.ts';
import { Principal } from '../src/types/principal.ts';
import { AuthenticationError } from '../src/types/error.ts';

const USERS: Record<string, Principal> = {
  a: {
    id: 'a',
    issuer: 'none',
    permissions: ['1', '2', '3'],
    details: {}
  }
};

class CustomAuthorizer implements Authorizer {
  async authorize(p: Principal): Promise<Principal> {
    if (!(p.id in USERS)) {
      throw new AuthenticationError('User is not found', { category: 'notfound' });
    }
    return USERS[p.id];
  }
}

@Suite()
export class PrincipalTest {

  @Test()
  async verifyTypings() {
    const source = new CustomAuthorizer();
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

    const p = await source.authorize({
      id: 'a',
      details: {},
      permissions: [],
      issuer: 'none'
    });

    assert(p.issuer === 'none');
    assert.deepStrictEqual(p.permissions, ['1', '2', '3']);
  }
}
