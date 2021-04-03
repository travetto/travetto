import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { PathUtil } from '../src';
import { ModuleUtil } from '../src/internal/module-util';

@Suite()
export class ModuleUtilSuite {
  @Test()
  async getId() {
    PathUtil.setDevPath('@@@@');
    const modId = ModuleUtil.getId(__filename);
    assert(modId === './test/module-util');

    const modId2 = ModuleUtil.getId(`${__dirname}/node_modules/@travetto/base/src/module-util.js`);
    assert(modId2 === '@trv:base/module-util');

    const modId3 = ModuleUtil.getId(`${__dirname}/../test/simple.js`);
    assert(modId3 === './test/simple');

    const modId4 = ModuleUtil.getId(`${__dirname}/node_modules/lodash/test`);
    assert(modId4 === '@npm/lodash/test');
    PathUtil.setDevPath(undefined);
  }
}