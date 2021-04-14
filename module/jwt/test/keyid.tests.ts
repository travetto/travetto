import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { JWTUtil } from '..';

@Suite('test keyid')
class KeyIdSuite {
  @Test('Verify keyid')
  async verify() {
    const claims = { name: 'doron', age: 46 };
    const token = await JWTUtil.create(claims, { key: 'secret', header: { kid: '1234' } });
    const res = JWTUtil.read(token);
    assert(res.header.kid === '1234');
    await JWTUtil.verify(token, { key: 'secret' });
  }
}
