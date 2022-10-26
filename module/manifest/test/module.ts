import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { ModuleIndex } from '..';

@Suite()
class ModuleIndexTests {
  @Test()
  testFind() {
    const files = ModuleIndex.find({});
    assert(files.some(x => x.file.endsWith('test/module.ts')));
  }

  @Test()
  async getId() {
    const modId = ModuleIndex.computeId(__source.file);
    assert(modId === './test/module-util');

    const modId2 = ModuleIndex.computeId(`${__source.folder}/node_modules/@travetto/base/src/module-util.js`);
    assert(modId2 === '@trv:base/module-util');

    const modId3 = ModuleIndex.computeId(`${__source.folder}/../test/simple.js`);
    assert(modId3 === './test/simple');

    const modId4 = ModuleIndex.computeId(`${__source.folder}/node_modules/lodash/test`);
    assert(modId4 === '@npm/lodash/test');
  }
}