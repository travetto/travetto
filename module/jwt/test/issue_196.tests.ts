import assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { JWTUtil } from '../src/util';

function atob(str: string) {
  return Buffer.from(str, 'base64').toString('binary');
}
function base64toUtf8(str: string) {
  return decodeURIComponent(escape(atob(str)));
}

@Suite('issue 196')
class Issue196 {

  @Test('should use issuer provided in payload.iss')
  async test() {
    const token = await JWTUtil.create({ iss: 'foo' }, { key: 'shhhhh' });
    const issuer = JSON.parse(base64toUtf8(token.split('.')[1])).iss;
    assert(issuer === 'foo');
  }
}
