import assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { path } from '@travetto/manifest';

import { RootIndex } from '../src/root-index';

@Suite()
class RootIndexTests {
  @Test()
  testFind() {
    const files = RootIndex.find({});
    assert(files.some(x => x.output.endsWith('test/root-index.js')));
  }

  @Test()
  async getId() {
    const location = RootIndex.getModule('@travetto/manifest');
    assert(location);

    const { outputPath } = location;

    const modId = RootIndex.getId(path.resolve(outputPath, 'test', 'root-index.js'));
    assert(modId === '@travetto/manifest:test/root-index');

    const modId2 = RootIndex.getId(path.resolve(RootIndex.getModule('@travetto/test')!.outputPath, 'src', 'assert', 'util.js'));
    assert(modId2 === '@travetto/test:src/assert/util');

    const modId3 = RootIndex.getId(path.resolve(outputPath, 'test', 'fixtures', 'simple.ts'));
    assert(modId3 === '@travetto/manifest:test/fixtures/simple.ts');
  }

  @Test()
  async testModuleExpression() {

    const found = RootIndex.getModuleList('local');
    assert(found.size >= 1);
    assert(found.has('@travetto/base'));

    let found2 = RootIndex.getModuleList('all');
    assert(found2.size > 1);
    assert(found2.has('@travetto/base'));
    assert(found2.has('@travetto/manifest'));

    found2 = RootIndex.getModuleList('local', '*');
    assert(found2.size > 1);
    assert(found2.has('@travetto/base'));
    assert(found2.has('@travetto/manifest'));

    found2 = RootIndex.getModuleList('local', '@travetto/*');
    assert(found2.size > 1);
    assert(found2.has('@travetto/base'));
    assert(found2.has('@travetto/manifest'));

    let found3 = RootIndex.getModuleList('local', '-@travetto/base');
    assert(found3.size === found.size - 1);
    assert(!found3.has('@travetto/base'));

    found3 = RootIndex.getModuleList('local', '*,-@travetto/base');
    assert(found3.size === found2.size - 1);
    assert(!found3.has('@travetto/base'));
    assert(found3.has('@travetto/manifest'));

    found3 = RootIndex.getModuleList('local', '*,-@travetto/*');
    assert(!found3.size);
    assert(!found3.has('@travetto/base'));
    assert(!found3.has('@travetto/manifest'));
  }
}