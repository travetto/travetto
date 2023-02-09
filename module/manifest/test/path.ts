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
}