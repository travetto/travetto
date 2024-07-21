import assert from 'node:assert';
import path from 'node:path';

import { Suite, Test } from '@travetto/test';

import { RuntimeIndex } from '../src/metadata';

@Suite()
class RuntimeIndexTests {
  @Test()
  testFind() {
    const files = RuntimeIndex.find({ folder: f => f === 'test' });
    assert(files.some(x => x.outputFile.endsWith('test/runtime.js')));
  }

  @Test()
  async getId() {
    const location = RuntimeIndex.getModule('@travetto/manifest');
    assert(location);

    const { outputPath } = location;

    const modId = RuntimeIndex.getId(path.resolve(outputPath, 'test', 'runtime.js'));
    assert(modId === '@travetto/manifest:test/runtime');

    const modId2 = RuntimeIndex.getId(path.resolve(RuntimeIndex.getModule('@travetto/test')!.outputPath, 'src', 'assert', 'util.js'));
    assert(modId2 === '@travetto/test:src/assert/util');

    const modId3 = RuntimeIndex.getId(path.resolve(outputPath, 'test', 'fixtures', 'simple.ts'));
    assert(modId3 === '@travetto/manifest:test/fixtures/simple.ts');
  }

  @Test()
  async testModuleExpression() {

    const found = RuntimeIndex.getModuleList('workspace');
    assert(found.size >= 1);
    assert(found.has('@travetto/base'));

    let found2 = RuntimeIndex.getModuleList('all');
    assert(found2.size > 1);
    assert(found2.has('@travetto/base'));
    assert(found2.has('@travetto/manifest'));

    found2 = RuntimeIndex.getModuleList('workspace', '*');
    assert(found2.size > 1);
    assert(found2.has('@travetto/base'));
    assert(found2.has('@travetto/manifest'));

    found2 = RuntimeIndex.getModuleList('workspace', '@travetto/*');
    assert(found2.size > 1);
    assert(found2.has('@travetto/base'));
    assert(found2.has('@travetto/manifest'));

    let found3 = RuntimeIndex.getModuleList('workspace', '-@travetto/base');
    assert(found3.size === found.size - 1);
    assert(!found3.has('@travetto/base'));

    found3 = RuntimeIndex.getModuleList('workspace', '*,-@travetto/base');
    assert(found3.size === found2.size - 1);
    assert(!found3.has('@travetto/base'));
    assert(found3.has('@travetto/manifest'));

    found3 = RuntimeIndex.getModuleList('workspace', '*,-@travetto/*');
    assert(!found3.size);
    assert(!found3.has('@travetto/base'));
    assert(!found3.has('@travetto/manifest'));
  }
}