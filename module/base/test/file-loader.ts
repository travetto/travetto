import fs from 'node:fs/promises';
import assert from 'node:assert';
import path from 'node:path';

import { Suite, Test } from '@travetto/test';
import { FileLoader } from '../src/file-loader';
import { RuntimeIndex } from '@travetto/manifest';

@Suite()
class FileLoaderSuite {

  @Test()
  async simpleTest() {
    const loader = new FileLoader(['@#test/fixtures']);
    assert(loader.searchPaths.includes(path.resolve(RuntimeIndex.mainModule.sourcePath, 'test/fixtures')));

    await assert.doesNotReject(() => loader.resolve('logo.png'));
    const loc = await loader.resolve('logo.png');
    assert(loc.startsWith(RuntimeIndex.mainModule.sourcePath));

    const stat = await fs.stat(loc);
    assert((await loader.read('logo.png', true)).length === stat.size);
  }
}