import fs from 'node:fs/promises';
import assert from 'node:assert';
import path from 'node:path';

import { Suite, Test } from '@travetto/test';

import { FileLoader } from '../src/file-loader.ts';
import { Runtime } from '../src/context.ts';

@Suite()
class FileLoaderSuite {

  @Test()
  async simpleTest() {
    const loader = new FileLoader([Runtime.modulePath('@#test/fixtures')]);
    assert(loader.searchPaths.includes(path.resolve(Runtime.mainSourcePath, 'test/fixtures')));

    await assert.doesNotReject(() => loader.resolve('logo.png'));
    const loc = await loader.resolve('logo.png');
    assert(loc.startsWith(Runtime.mainSourcePath));

    const stat = await fs.stat(loc);
    assert((await loader.read('logo.png', true)).length === stat.size);
  }
}