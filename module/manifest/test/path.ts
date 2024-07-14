import assert from 'node:assert';
import winPath from 'node:path/win32';
import path from 'node:path/trv';

import { Suite, Test } from '@travetto/test';

import { toPosix } from '../src/path';

@Suite()
class PathTests {

  @Test()
  verifyRelative() {
    const pwd = path.resolve().replace(/[a-z\- ]+/g, '..');
    assert(pwd.includes('../../..'));
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
    }
  }

  @Test()
  verifyWin32Paths() {
    const winResolve = (...args: string[]): string => toPosix(winPath.resolve(path.resolve(), ...args.map(toPosix)));
    const winJoin = (root: string, ...args: string[]): string => toPosix(winPath.join(toPosix(root), ...args.map(toPosix)));


    assert(winResolve('C:\\Docs\\Bob', 'orange\\red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winResolve('C:\\Docs\\Bob', 'orange/red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winResolve('C:\\Docs\\Bob', '../red.png') === 'C:/Docs/red.png');

    assert(winJoin('C:\\Docs\\Bob', 'orange\\red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winJoin('C:\\Docs\\Bob', 'orange/red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winJoin('C:\\Docs\\Bob', '../red.png') === 'C:/Docs/red.png');
  }
}