import * as assert from 'assert';
import { Suite, Test, ShouldThrow } from '@travetto/test';

import * as jwt from '..';

@Suite('issue 147 - signing with a sealed payload')
class Issue147Suite {

  @Test('should put the expiration claim')
  async test() {
    const NOW = Math.trunc(Date.now() / 1000);
    const token = await jwt.sign(Object.seal({ foo: 123, exp: NOW + 10 }), { key: '123' });
    const result = await jwt.verify(token, { key: '123' });

    assert(result.exp === NOW + 10);
  }
}