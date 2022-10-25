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
}