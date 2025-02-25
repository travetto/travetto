import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { RuntimeIndex } from '../src/manifest-index.ts';

@Suite()
class RuntimeIndexTests {
  @Test()
  testFind() {
    const files = RuntimeIndex.find({ folder: f => f === 'test' });
    assert(files.some(x => x.outputFile.endsWith('test/runtime.js')));
  }

  @Test()
  async testModuleExpression() {

    const found = RuntimeIndex.getModuleList('workspace');
    assert(found.size >= 1);
    assert(found.has('@travetto/runtime'));

    let found2 = RuntimeIndex.getModuleList('all');
    assert(found2.size > 1);
    assert(found2.has('@travetto/runtime'));
    assert(found2.has('@travetto/manifest'));

    found2 = RuntimeIndex.getModuleList('workspace', '*');
    assert(found2.size > 1);
    assert(found2.has('@travetto/runtime'));
    assert(found2.has('@travetto/manifest'));

    found2 = RuntimeIndex.getModuleList('workspace', '@travetto/*');
    assert(found2.size > 1);
    assert(found2.has('@travetto/runtime'));
    assert(found2.has('@travetto/manifest'));

    let found3 = RuntimeIndex.getModuleList('workspace', '-@travetto/runtime');
    assert(found3.size === found.size - 1);
    assert(!found3.has('@travetto/runtime'));

    found3 = RuntimeIndex.getModuleList('workspace', '*,-@travetto/runtime');
    assert(found3.size === found2.size - 1);
    assert(!found3.has('@travetto/runtime'));
    assert(found3.has('@travetto/manifest'));

    found3 = RuntimeIndex.getModuleList('workspace', '*,-@travetto/*');
    assert(!found3.size);
    assert(!found3.has('@travetto/runtime'));
    assert(!found3.has('@travetto/manifest'));
  }
}