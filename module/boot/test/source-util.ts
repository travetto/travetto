import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { PathUtil } from '../src';
import { SourceUtil } from '../src/internal/source-util';

@Suite()
export class SourceUtilSuite {
  @Test()
  async getId() {
    PathUtil.setDevPath('@@@@');
    const modId = SourceUtil.getSourceId(__filename);
    assert(modId === './test/source-util');

    const modId2 = SourceUtil.getSourceId(`${__dirname}/node_modules/@travetto/base/src/source-util.js`);
    assert(modId2 === '@trv:base/source-util');

    const modId3 = SourceUtil.getSourceId(`${__dirname}/../test/simple.js`);
    assert(modId3 === './test/simple');

    const modId4 = SourceUtil.getSourceId(`${__dirname}/node_modules/lodash/test`);
    assert(modId4 === '@npm/lodash/test');
    PathUtil.setDevPath(undefined);
  }
}