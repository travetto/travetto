import * as assert from 'assert';

import { AppError } from '@travetto/base';
import { Suite, Test } from '@travetto/test';

import { Authorizer } from '../src/types/authorizer';
import { Principal } from '../src/types/principal';

const USERS: Record<string, Principal> = {
  a: {
    id: 'a',
    permissions: ['1', '2', '3'],
    details: {}
  }
};

class CustomAuthorizer implements Authorizer {
  async authorize(p: Principal): Promise<Principal> {
    if (!(p.id in USERS)) {
      throw new AppError('User is not found', 'notfound');
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
    assert(p.permissions === ['1', '2', '3']);
  }
}
