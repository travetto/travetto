import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { JWTUtil } from '../src/util';

@Suite('test keyId')
class KeyIdSuite {
  @Test('Verify keyId')
  async verify() {
    const claims = { name: 'DoDon', age: 46 };
    const token = await JWTUtil.create(claims, { key: 'secret', header: { kid: '1234' } });
    const res = JWTUtil.read(token);
    assert(res.header.kid === '1234');
    await JWTUtil.verify(token, { key: 'secret' });
  }
}
