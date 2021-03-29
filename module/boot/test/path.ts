import * as assert from 'assert';

import { Test, Suite, AfterEach } from '@travetto/test';
import { PathUtil } from '../src';

const ogPath = PathUtil['devPath'];

@Suite()
export class PathTest {

  @AfterEach()
  after() {
    PathUtil['devPath'] = ogPath;
  }

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

  @Test()
  async resolveFramework() {
    assert(PathUtil.resolveFrameworkPath('test') === 'test');
    assert(PathUtil.resolveFrameworkPath('test/test2') === 'test/test2');
    assert(PathUtil.resolveFrameworkPath('test\\test2') === 'test\\test2');

    delete PathUtil['devPath'];
    assert(PathUtil.resolveFrameworkPath('@travetto/temp') === '@travetto/temp');
    assert(PathUtil.resolveFrameworkPath('node_modules/@travetto/temp') === 'node_modules/@travetto/temp');
    PathUtil['devPath'] = 'base';
    assert(PathUtil.resolveFrameworkPath('@travetto/temp') === 'base/temp');
    assert(PathUtil.resolveFrameworkPath('node_modules/@travetto/temp') === 'base/temp');
  }

  @Test()
  async normalizeFramework() {
    assert(PathUtil.normalizeFrameworkPath('test') === 'test');
    assert(PathUtil.normalizeFrameworkPath('test/test2') === 'test/test2');
    assert(PathUtil.normalizeFrameworkPath('test\\test2') === 'test\\test2');

    delete PathUtil['devPath'];
    assert(PathUtil.normalizeFrameworkPath('@travetto/temp') === '@travetto/temp');
    assert(PathUtil.normalizeFrameworkPath('@travetto/temp', 'node_modules/') === '@travetto/temp');
    PathUtil['devPath'] = 'base';
    assert(PathUtil.normalizeFrameworkPath('base/temp') === '@travetto/temp');
    assert(PathUtil.normalizeFrameworkPath('base/temp', 'node_modules/') === 'node_modules/@travetto/temp');
  }
}