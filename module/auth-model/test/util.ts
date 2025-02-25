import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { AuthModelUtil } from '../src/util.ts';

@Suite()
export class UtilTest {

  @Test()
  async testHash() {
    const hash = AuthModelUtil.generateHash('hello', 'test', 100, 20);
    assert((await hash).length === 20);
  }

  @Test()
  async testPassword() {
    const { hash, salt } = await AuthModelUtil.generatePassword('hello', 32);
    assert(salt.length === 32);
    assert(hash !== 'hello');
  }
}
