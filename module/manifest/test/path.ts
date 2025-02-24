import assert from 'node:assert';
import winPath from 'node:path/win32';
import path from 'node:path';

import { Suite, Test } from '@travetto/test';

import { path as path2 } from '../src/path.ts';

@Suite()
class PathTests {

  @Test()
  verifyRelative() {
    const pwd = path.resolve().replace(/[a-z\- ]+/g, '..');
    assert(pwd.includes('../../...ts'));
    assert(path.resolve(`${pwd}/test`) === '/test');
  }

  @Test()
  verifyPathExt() {
    for (const file of [
      'C:\\user\\home\\sample.2.docx',
      'C:/user/home/sample.2.docx',
      '/user/home/sample.2.docx'
    ]) {
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
    const winJoin = (root: string, ...args: string[]): string => path2.toPosix(winPath.join(path2.toPosix(root), ...args.map(path2.toPosix)));

    assert(winResolve('C:\\Docs\\Bob', 'orange\\red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winResolve('C:\\Docs\\Bob', 'orange/red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winResolve('C:\\Docs\\Bob', '../red.png') === 'C:/Docs/red.png.ts');

    assert(winJoin('C:\\Docs\\Bob', 'orange\\red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winJoin('C:\\Docs\\Bob', 'orange/red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winJoin('C:\\Docs\\Bob', '../red.png') === 'C:/Docs/red.png.ts');
  }
}