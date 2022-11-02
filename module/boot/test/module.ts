import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { ModuleIndex } from '../src/module-index';

@Suite()
class ModuleIndexTests {
  @Test()
  testFind() {
    const files = ModuleIndex.find({});
    assert(files.some(x => x.file.endsWith('test/module.ts')));
  }

  @Test()
  async getId() {
    const modId = ModuleIndex.getId(__source.file);
    assert(modId === './test/module-util');

    const modId2 = ModuleIndex.getId(`${__source.folder}/node_modules/@travetto/boot/src/module-index.js`);
    assert(modId2 === '@trv:boot/module-util');

    const modId3 = ModuleIndex.getId(`${__source.folder}/../test/simple.js`);
    assert(modId3 === './test/simple');
  }
}