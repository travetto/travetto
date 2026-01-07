import assert from 'node:assert';
import winPath from 'node:path/win32';

import { Suite, Test } from '@travetto/test';
import { path } from '@travetto/manifest';

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
      assert(!path.dirname(file).includes('\\'));
    }
  }

  @Test()
  verifyWin32Paths() {
    const winResolve = (...args: string[]): string => path.toPosix(winPath.resolve(path.resolve(), ...args.map(path.toPosix)));
    const winJoin = (root: string, ...args: string[]): string => path.toPosix(winPath.join(path.toPosix(root), ...args.map(path.toPosix)));

    assert(winResolve('C:\\Docs\\Bob', 'orange\\red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winResolve('C:\\Docs\\Bob', 'orange/red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winResolve('C:\\Docs\\Bob', '../red.png') === 'C:/Docs/red.png');

    assert(winJoin('C:\\Docs\\Bob', 'orange\\red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winJoin('C:\\Docs\\Bob', 'orange/red.png') === 'C:/Docs/Bob/orange/red.png');
    assert(winJoin('C:\\Docs\\Bob', '../red.png') === 'C:/Docs/red.png');
  }
}