import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { RegisterUtil } from '../src/register';

@Suite()
class RegisterUtilTests {

  @Test()
  async buildModuleName() {
    const modName = RegisterUtil.computeModuleFromFile(__filename);
    assert(modName === '@app/test.register-util');

    const modName2 = RegisterUtil.computeModuleFromFile('node_modules/@travetto/boot/src/register-util.js');
    assert(modName2 === '@trv:boot/register-util');
  }

}