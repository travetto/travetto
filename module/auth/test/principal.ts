import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { PrincipalConfig } from '../src/principal';

class User {
  id: string;
  perms: Set<string>;
}

@Suite()
export class PrincipalTest {

  @Test()
  async verifyTypings() {
    const config = new PrincipalConfig(User, {
      id: 'id',
      permissions: 'perms'
    });

    assert(config.getId({ id: 'a', perms: new Set() }) === 'a');
  }
}
