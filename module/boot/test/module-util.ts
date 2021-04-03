import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { PathUtil } from '../src';
import { ModuleUtil } from '../src/internal/module-util';

@Suite()
export class ModuleUtilSuite {
  @Test()
  async getId() {
    const og = PathUtil['devPath'];
    PathUtil['devPath'] = '@@@@';
    const modId = ModuleUtil.getId(__filename);
    assert(modId === './test/system-util');

    const modId2 = ModuleUtil.getId(`${__dirname}/node_modules/@travetto/base/src/system-util.js`);
    assert(modId2 === '@trv:base/system-util');

    const modId3 = ModuleUtil.getId(`${__dirname}/../test/simple.js`);
    assert(modId3 === './test/simple');

    const modId4 = ModuleUtil.getId(`${__dirname}/node_modules/lodash/test`);
    assert(modId4 === '@npm/lodash/test');
    PathUtil['devPath'] = og;
  }
}