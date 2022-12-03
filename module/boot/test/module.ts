import assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { path } from '@travetto/boot';

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
    assert(modId === '@travetto/boot:test/module');

    const modId2 = ModuleIndex.getId(path.resolve(path.dirname(__output), '..', '..', 'test', 'src', 'assert', 'util.js'));
    assert(modId2 === '@travetto/test:src/assert/util');

    const modId3 = ModuleIndex.getId(path.resolve(path.dirname(__output), 'fixtures', 'simple.ts'));
    assert(modId3 === '@travetto/boot:test/fixtures/simple.ts');
  }

  @Test()
  async testModuleExpression() {

    const found = ModuleIndex.getModuleList('local');
    assert(found.size >= 1);
    assert(found.has('@travetto/boot'));

    let found2 = ModuleIndex.getModuleList('all');
    assert(found2.size > 1);
    assert(found2.has('@travetto/boot'));
    assert(found2.has('@travetto/manifest'));

    found2 = ModuleIndex.getModuleList('local', '*');
    assert(found2.size > 1);
    assert(found2.has('@travetto/boot'));
    assert(found2.has('@travetto/manifest'));

    found2 = ModuleIndex.getModuleList('local', '@travetto/*');
    assert(found2.size > 1);
    assert(found2.has('@travetto/boot'));
    assert(found2.has('@travetto/manifest'));

    let found3 = ModuleIndex.getModuleList('local', '-@travetto/boot');
    assert(found3.size === found.size - 1);
    assert(!found3.has('@travetto/boot'));

    found3 = ModuleIndex.getModuleList('local', '*,-@travetto/boot');
    assert(found3.size === found2.size - 1);
    assert(!found3.has('@travetto/boot'));
    assert(found3.has('@travetto/manifest'));

    found3 = ModuleIndex.getModuleList('local', '*,-@travetto/*');
    assert(!found3.size);
    assert(!found3.has('@travetto/boot'));
    assert(!found3.has('@travetto/manifest'));
  }
}