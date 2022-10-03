import * as assert from 'assert';
import { AfterEach, Suite, Test } from '@travetto/test';

import { ModuleUtil } from '../src/internal/module-util';

@Suite()
export class ModuleUtilSuite {

  @AfterEach()
  after() {
    ModuleUtil.setDevPath(undefined);
  }

  @Test()
  async getId() {
    ModuleUtil.setDevPath('@@@@');
    const modId = ModuleUtil.computeId(__filename);
    assert(modId === './test/module-util');

    const modId2 = ModuleUtil.computeId(`${__dirname}/node_modules/@travetto/base/src/module-util.js`);
    assert(modId2 === '@trv:base/module-util');

    const modId3 = ModuleUtil.computeId(`${__dirname}/../test/simple.js`);
    assert(modId3 === './test/simple');

    const modId4 = ModuleUtil.computeId(`${__dirname}/node_modules/lodash/test`);
    assert(modId4 === '@npm/lodash/test');
    ModuleUtil.setDevPath(undefined);
  }

  @Test()
  async resolveFramework() {
    assert(ModuleUtil.resolveFrameworkPath('test') === 'test');
    assert(ModuleUtil.resolveFrameworkPath('test/test2') === 'test/test2');
    assert(ModuleUtil.resolveFrameworkPath('test\\test2') === 'test\\test2');

    ModuleUtil.setDevPath('');
    assert(ModuleUtil.resolveFrameworkPath('@travetto/temp') === '@travetto/temp');
    assert(ModuleUtil.resolveFrameworkPath('node_modules/@travetto/temp') === 'node_modules/@travetto/temp');
    ModuleUtil.setDevPath('base');
    assert(ModuleUtil.resolveFrameworkPath('@travetto/temp') === 'base/temp');
    assert(ModuleUtil.resolveFrameworkPath('node_modules/@travetto/temp') === 'base/temp');
  }

  @Test()
  async normalizeFramework() {
    assert(ModuleUtil.normalizeFrameworkPath('test') === 'test');
    assert(ModuleUtil.normalizeFrameworkPath('test/test2') === 'test/test2');
    assert(ModuleUtil.normalizeFrameworkPath('test\\test2') === 'test\\test2');

    ModuleUtil.setDevPath('');
    assert(ModuleUtil.normalizeFrameworkPath('@travetto/temp') === '@travetto/temp');
    assert(ModuleUtil.normalizeFrameworkPath('@travetto/temp', 'node_modules/') === '@travetto/temp');
    ModuleUtil.setDevPath('base');
    assert(ModuleUtil.normalizeFrameworkPath('base/temp') === '@travetto/temp');
    assert(ModuleUtil.normalizeFrameworkPath('base/temp', 'node_modules/') === 'node_modules/@travetto/temp');
  }
}