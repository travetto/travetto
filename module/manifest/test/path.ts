import assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { path } from '@travetto/manifest';

@Suite()
class PathTests {

  @Test()
  verifyRelative() {
    const pwd = path.cwd().replace(/[a-z\- ]+/g, '..');
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
}