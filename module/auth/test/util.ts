import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { AuthUtil } from '../src/util';

@Suite()
export class UtilTest {

  @Test()
  async testPermissions() {
    const { check: checker } = AuthUtil.permissionChecker(['a', 'b'], ['c', 'd'], 'all');
    assert(checker(new Set(['a', 'b'])) === true);
    assert(checker(new Set(['a', 'b', 'c', 'd'])) === false);

    const { check: checker2 } = AuthUtil.permissionChecker(['a', 'b'], ['c', 'd'], 'any');
    assert(checker2(new Set(['a'])) === true);
    assert(checker2(new Set(['b'])) === true);
    assert(checker2(new Set(['a', 'b', 'c'])) === false);

    const { check: checker3 } = AuthUtil.permissionChecker([], ['c', 'd'], 'any');
    assert(checker3(new Set(['a'])) === true);
    assert(checker3(new Set([])) === true);
  }

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
