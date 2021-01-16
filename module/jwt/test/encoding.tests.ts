import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import * as jwt from '..';

function atob(str: string) {
  return Buffer.from(str, 'base64').toString('binary');
}
function base64toUtf8(str: string) {
  return decodeURIComponent(escape(atob(str)));
}

@Suite('encoding')
class EncodingTest {

  @Test('should properly encode the token (utf8)')
  async testUTF8() {
    const expected = 'José';
    const token = await jwt.sign({ name: expected }, { key: 'shhhhh' });
    const decodedName = JSON.parse(base64toUtf8(token.split('.')[1])).name;
    assert(decodedName === expected);
  }

  @Test('should properly encode the token (binary)')
  async tesBinary() {
    const expected = 'José';
    const token = await jwt.sign({ name: expected }, { key: 'shhhhh', encoding: 'binary' });
    const decodedName = JSON.parse(atob(token.split('.')[1])).name;
    assert(decodedName === expected);
  }

  @Test('should return the same result when decoding')
  async decoding() {
    const username = '測試';

    const token = await jwt.sign({ username }, { key: 'test' });

    const payload = await jwt.verify(token, { key: 'test' });

    assert(payload.username === username);
  }
}
