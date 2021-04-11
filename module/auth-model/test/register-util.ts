import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { RegistrationUtil } from '../src/register-util';

@Suite()
export class RegisterUtilSuite {

  @Test()
  async testHash() {
    const hash = RegistrationUtil.generateHash('hello', 'test', 100, 20);
    assert((await hash).length === 20);
  }

  @Test()
  async testPassword() {
    const { hash, salt } = await RegistrationUtil.generatePassword('hello', 32);
    assert(salt.length === 32);
    assert(hash !== 'hello');
  }
}