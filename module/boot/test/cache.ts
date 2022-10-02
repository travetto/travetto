import * as assert from 'assert';

import { Test, Suite, AfterEach, BeforeAll } from '@travetto/test';

import { PathUtil } from '../src';
import { ModuleFileCache } from '../src/internal/module-cache';

@Suite()
export class CacheSuite {

  cache: ModuleFileCache;

  @BeforeAll()
  before() {
    this.cache = new ModuleFileCache('.test');
  }

  @AfterEach()
  after() {
    PathUtil.setDevPath(undefined);
  }

  @Test()
  async fromEntryName() {
    assert(this.cache['fromEntryName']('test/test2') === PathUtil.resolveUnix('test/test2'));
    assert(this.cache['fromEntryName'](`${this.cache.cacheDir}/test/test2`) === PathUtil.resolveUnix('test/test2'));
    assert(this.cache['fromEntryName']('test\\test2') === PathUtil.resolveUnix('test/test2'));
    assert(this.cache['fromEntryName'](`${this.cache.cacheDir}\\test\\test2`) === PathUtil.resolveUnix('test/test2'));

    PathUtil.setDevPath('');
    assert(this.cache['fromEntryName']('node_modules/@travetto/test/second') === PathUtil.resolveUnix('node_modules/@travetto/test/second'));
    assert(this.cache['fromEntryName'](`${this.cache.cacheDir}/node_modules/@travetto/test/second`) === PathUtil.resolveUnix('node_modules/@travetto/test/second'));
    PathUtil.setDevPath('/base');
    assert(this.cache['fromEntryName']('node_modules/@travetto/test/second') === PathUtil.resolveUnix('/base/test/second'));
    assert(this.cache['fromEntryName'](`${this.cache.cacheDir}/node_modules/@travetto/test/second`) === PathUtil.resolveUnix('/base/test/second'));
  }

  @Test()
  async toEntryName() {
    assert(this.cache['toEntryName']('test/test2') === `${this.cache.cacheDir}/test/test2`);
    assert(this.cache['toEntryName']('test\\test2.js') === `${this.cache.cacheDir}/test/test2.js`);

    PathUtil.setDevPath('');
    assert(this.cache['toEntryName']('node_modules/@travetto/test/second.ts') === `${this.cache.cacheDir}/node_modules/@travetto/test/second.js`);
    PathUtil.setDevPath('/base');
    assert(this.cache['toEntryName']('/base/test/second.ts') === `${this.cache.cacheDir}/node_modules/@travetto/test/second.js`);
    assert(this.cache['toEntryName']('node_modules/@travetto/test/second.ts') === `${this.cache.cacheDir}/node_modules/@travetto/test/second.js`);
  }
}