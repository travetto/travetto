import * as assert from 'assert';
import { Suite, Test, ShouldThrow } from '@travetto/test';

import * as jwt from '..';

function atob(str: string) {
  return Buffer.from(str, 'base64').toString('binary');
}
function b64_to_utf8(str: string) {
  return decodeURIComponent(escape(atob(str)));
}

@Suite('issue 196')
class Issue196 {

  @Test('should use issuer provided in payload.iss')
  async test() {
    const token = await jwt.sign({ iss: 'foo' }, { key: 'shhhhh' });
    const decoded_issuer = JSON.parse(b64_to_utf8(token.split('.')[1])).iss;
    assert(decoded_issuer === 'foo');
  }
}
