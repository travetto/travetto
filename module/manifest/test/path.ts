import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import winPath from 'node:path/win32';

import { ManifestUtil, path as path2 } from '@travetto/manifest';
import { Suite, Test } from '@travetto/test';

@Suite()
class PathTests {
  @Test()
  verifyRelative() {
    const pwd = path.resolve().replace(/[a-z\- ]+/gi, '..');
    assert(pwd.includes('../../..'));
    assert(path.resolve(`${pwd}/test`) === '/test');
  }

  @Test()
  verifyPathExt() {
    for (const file of ['C:\\user\\home\\sample.2.docx', 'C:/user/home/sample.2.docx', '/user/home/sample.2.docx']) {
      assert(path.basename(file) === 'sample.2.docx');
      assert(path.extname(file) === '.docx');
      assert(path.basename(file, path.extname(file)) === 'sample.2');
      assert(path.basename(file) === path2.basename(file));
      assert(path.extname(file) === path2.extname(file));
      assert(path.basename(file, path.extname(file)) === path2.basename(file, path2.extname(file)));
    }
  }

  @Test()
  verifyWin32Paths() {
    const winResolve = (...args: string[]): string => path2.toPosix(winPath.resolve(path.resolve(), ...args.map(path2.toPosix)));
    const winJoin = (root: string, ...args: string[]): string =>
      path2.toPosix(winPath.join(path2.toPosix(root), ...args.map(path2.toPosix)));

    assert(winResolve('C:\\Docs\\Bob', 'orange\\red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winResolve('C:\\Docs\\Bob', 'orange/red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winResolve('C:\\Docs\\Bob', '../red.png') === 'C:/Docs/red.png');

    assert(winJoin('C:\\Docs\\Bob', 'orange\\red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winJoin('C:\\Docs\\Bob', 'orange/red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winJoin('C:\\Docs\\Bob', '../red.png') === 'C:/Docs/red.png');
  }

  @Test()
  async verifyLookupTrieNestedPackageIsolation() {
    const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'trie-test-'));
    try {
      const cliDir = path.join(tempDirectory, 'module', 'cli');
      const docExecDir = path.join(cliDir, 'doc-exec', 'support');
      await fs.promises.mkdir(docExecDir, { recursive: true });
      await fs.promises.writeFile(path.join(cliDir, 'package.json'), '{}');
      await fs.promises.writeFile(path.join(cliDir, 'doc-exec', 'package.json'), '{}');

      const lookup = ManifestUtil.lookupTrie(
        [{ name: '@travetto/cli', sourceFolder: 'module/cli' }],
        item => item.sourceFolder.split('/'),
        sub => !fs.existsSync(path.resolve(tempDirectory, ...sub, 'package.json'))
      );

      assert.strictEqual(lookup(['module', 'cli', 'src', 'main.ts'])?.name, '@travetto/cli');
      assert.strictEqual(lookup(['module', 'cli', 'doc-exec', 'support', 'cli.basic.ts']), undefined);
    } finally {
      await fs.promises.rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
