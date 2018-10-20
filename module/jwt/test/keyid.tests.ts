import * as assert from 'assert';

import { Suite, Test, ShouldThrow } from '@travetto/test';

import * as jwt from '..';

@Suite('test keyid')
class KeyIdSuite {
  @Test('Verify keyid')
  async verify() {
    const claims = { name: 'doron', age: 46 };
    const token = await jwt.sign(claims, { key: 'secret', header: { kid: '1234' } });
    const res = await jwt.decodeComplete(token);
    assert(res.header.kid === '1234');
    const val = await jwt.verify(token, { key: 'secret' });
  }
}
