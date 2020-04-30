import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { AuthUtil } from '../src/util';

@Suite()
export class UtilTest {

  @Test()
  async testHash() {
    const hash = AuthUtil.generateHash('hello', 'test', 100, 20);
    assert((await hash).length === 20);
  }

  @Test()
  async testPassword() {
    const { hash, salt } = await AuthUtil.generatePassword('hello', 32);
    assert(salt.length === 32);
    assert(hash !== 'hello');
  }
}
