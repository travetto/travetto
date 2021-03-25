import * as assert from 'assert';

import { Test, Suite, AfterEach, BeforeAll } from '@travetto/test';
import { FileCache, PathUtil } from '../src';

const ogPath = PathUtil['devPath'];

@Suite()
export class CacheSuite {

  cache: FileCache;

  @BeforeAll()
  before() {
    this.cache = new FileCache('.test');
  }

  @AfterEach()
  after() {
    PathUtil['devPath'] = ogPath;
  }

  @Test()
  async fromEntryName() {
    assert(this.cache.fromEntryName('test/test2') === PathUtil.resolveUnix('test/test2'));
    assert(this.cache.fromEntryName(`${this.cache.cacheDir}/test/test2`) === PathUtil.resolveUnix('test/test2'));
    assert(this.cache.fromEntryName('test\\test2') === PathUtil.resolveUnix('test/test2'));
    assert(this.cache.fromEntryName(`${this.cache.cacheDir}\\test\\test2`) === PathUtil.resolveUnix('test/test2'));

    delete PathUtil['devPath'];
    assert(this.cache.fromEntryName('.test~second') === PathUtil.resolveUnix('node_modules/@travetto/test/second'));
    assert(this.cache.fromEntryName(`${this.cache.cacheDir}/.test~second`) === PathUtil.resolveUnix('node_modules/@travetto/test/second'));
    PathUtil['devPath'] = '/base';
    assert(this.cache.fromEntryName('.test~second') === PathUtil.resolveUnix('/base/test/second'));
    assert(this.cache.fromEntryName(`${this.cache.cacheDir}/.test~second`) === PathUtil.resolveUnix('/base/test/second'));
  }

  @Test()
  async toEntryName() {
    assert(this.cache.toEntryName('test/test2') === `${this.cache.cacheDir}/test~test2`);
    assert(this.cache.toEntryName('test\\test2.js') === `${this.cache.cacheDir}/test~test2.js`);

    delete PathUtil['devPath'];
    assert(this.cache.toEntryName('node_modules/@travetto/test/second.ts') === `${this.cache.cacheDir}/.test~second.ts`);
    PathUtil['devPath'] = '/base';
    assert(this.cache.toEntryName('/base/test/second.ts') === `${this.cache.cacheDir}/.test~second.ts`);
    assert(this.cache.toEntryName('node_modules/@travetto/test/second.ts') === `${this.cache.cacheDir}/.test~second.ts`);
  }
}