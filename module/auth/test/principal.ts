import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { PrincipalConfig } from '../src/principal';

class User {
  id: string;
  pw: string;
  perms: Set<string>;
}

@Suite()
export class PrincipalTest {

  @Test()
  async verifyTypings() {
    const config = new PrincipalConfig(User, {
      id: 'id',
      password: 'pw',
      permissions: 'perms'
    });

    assert(config.getId({ id: 'a', pw: '', perms: new Set() }) === 'a');
  }
}
