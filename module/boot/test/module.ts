import * as assert from 'assert';

import { path } from '@travetto/common';
import { Suite, Test } from '@travetto/test';
import { ModuleIndex } from '../src/module-index';

@Suite()
class ModuleIndexTests {
  @Test()
  testFind() {
    const files = ModuleIndex.find({});
    assert(files.some(x => x.output.endsWith('test/module.js')));
  }

  @Test()
  async getId() {
    const modId = ModuleIndex.getId(__output);
    assert(modId === '@travetto/boot/test/module');

    const modId2 = ModuleIndex.getId(path.resolve(path.dirname(__output), '..', '..', 'test', 'src', 'assert', 'util.ts'));
    assert(modId2 === '@trv:test/assert/util');

    const modId3 = ModuleIndex.getId(path.resolve(path.dirname(__output), 'fixtures', 'simple.ts'));
    assert(modId3 === '@travetto/boot/test/fixtures/simple');
  }
}