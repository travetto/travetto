import fs from 'fs/promises';
import assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { FileLoader } from '../src/file-loader';
import { RootIndex, path } from '@travetto/manifest';

@Suite()
class FileLoaderSuite {

  @Test()
  async simpleTest() {
    const loader = new FileLoader(['@#test/fixtures']);
    assert(loader.searchPaths.includes(path.resolve(RootIndex.mainModule.sourcePath, 'test/fixtures')));

    await assert.doesNotReject(() => loader.resolve('logo.png'));
    const loc = await loader.resolve('logo.png');
    assert(loc.startsWith(RootIndex.mainModule.sourcePath));

    const stat = await fs.stat(loc);
    assert((await loader.read('logo.png', true)).length === stat.size);
  }
}