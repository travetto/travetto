import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { ClassMetadataUtil } from '../src/internal/class-metadata';

@Suite()
export class ClassMetadataUtilTest {
  @Test()
  async getId() {
    const modId = ClassMetadataUtil.computeId(__source.file);
    assert(modId === './test/module-util');

    const modId2 = ClassMetadataUtil.computeId(`${__source.folder}/node_modules/@travetto/base/src/module-util.js`);
    assert(modId2 === '@trv:base/module-util');

    const modId3 = ClassMetadataUtil.computeId(`${__source.folder}/../test/simple.js`);
    assert(modId3 === './test/simple');

    const modId4 = ClassMetadataUtil.computeId(`${__source.folder}/node_modules/lodash/test`);
    assert(modId4 === '@npm/lodash/test');
  }
}