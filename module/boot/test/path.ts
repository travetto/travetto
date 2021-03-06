import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { PathUtil } from '../src';

@Suite()
export class PathTest {
  @Test()
  async toUnixSupport() {
    assert(PathUtil.toUnix('C:\\a\\b\\c\\d') === 'C:/a/b/c/d');
    assert(PathUtil.toUnix('/a/b/c/d') === '/a/b/c/d');

    assert(PathUtil.resolveUnix('/a/b', 'c/d') === '/a/b/c/d');
    assert(PathUtil.resolveUnix('/a/b', '/c/d') === '/c/d');

    assert(PathUtil.joinUnix('/a/b', 'c/d') === '/a/b/c/d');
    assert(PathUtil.joinUnix('/a/b', '/c/d') === '/a/b/c/d');
  }

  @Test()
  async toNativeSupport() {
    assert(PathUtil.toNative('C:\\a\\b\\c\\d') === 'C:/a/b/c/d');
    assert(PathUtil.toNative('C:\\a\\b\\c\\d') === 'C:/a/b/c/d');
  }
}