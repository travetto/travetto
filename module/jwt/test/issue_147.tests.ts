import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { JWTUtil } from '..';

@Suite('issue 147 - signing with a sealed payload')
class Issue147Suite {

  @Test('should put the expiration claim')
  async test() {
    const NOW = Math.trunc(Date.now() / 1000);
    const token = await JWTUtil.create(Object.seal({ foo: 123, exp: NOW + 10 }), { key: '123' });
    const result = await JWTUtil.verify(token, { key: '123' });

    assert(result.exp === NOW + 10);
  }
}