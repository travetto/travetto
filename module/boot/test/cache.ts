import * as assert from 'assert';

import { Test, Suite, AfterEach, BeforeAll } from '@travetto/test';

import { PathUtil } from '..';
import { $TranspileCache } from '../src/internal/transpile-cache';
import { ModuleUtil } from '../src/internal/module-util';

@Suite()
export class CacheSuite {

  cache: $TranspileCache;

  @BeforeAll()
  before() {
    this.cache = new $TranspileCache('.test');
  }

  @AfterEach()
  after() {
    ModuleUtil.setDevPath(undefined);
  }

  @Test()
  async fromEntryName() {
    assert(this.cache['fromEntryName']('test/test2') === PathUtil.resolveUnix('test/test2'));
    assert(this.cache['fromEntryName'](`${this.cache.outputDir}/test/test2`) === PathUtil.resolveUnix('test/test2'));
    assert(this.cache['fromEntryName']('test\\test2') === PathUtil.resolveUnix('test/test2'));
    assert(this.cache['fromEntryName'](`${this.cache.outputDir}\\test\\test2`) === PathUtil.resolveUnix('test/test2'));

    ModuleUtil.setDevPath('');
    assert(this.cache['fromEntryName']('node_modules/@travetto/test/second') === PathUtil.resolveUnix('node_modules/@travetto/test/second'));
    assert(this.cache['fromEntryName'](`${this.cache.outputDir}/node_modules/@travetto/test/second`) === PathUtil.resolveUnix('node_modules/@travetto/test/second'));
    ModuleUtil.setDevPath('/base');
    assert(this.cache['fromEntryName']('node_modules/@travetto/test/second') === PathUtil.resolveUnix('/base/test/second'));
    assert(this.cache['fromEntryName'](`${this.cache.outputDir}/node_modules/@travetto/test/second`) === PathUtil.resolveUnix('/base/test/second'));
  }

  @Test()
  async toEntryName() {
    assert(this.cache['toEntryName']('test/test2') === `${this.cache.outputDir}/test/test2`);
    assert(this.cache['toEntryName']('test\\test2.js') === `${this.cache.outputDir}/test/test2.js`);

    ModuleUtil.setDevPath('');
    assert(this.cache['toEntryName']('node_modules/@travetto/test/second.ts') === `${this.cache.outputDir}/node_modules/@travetto/test/second.js`);
    ModuleUtil.setDevPath('/base');
    assert(this.cache['toEntryName']('/base/test/second.ts') === `${this.cache.outputDir}/node_modules/@travetto/test/second.js`);
    assert(this.cache['toEntryName']('node_modules/@travetto/test/second.ts') === `${this.cache.outputDir}/node_modules/@travetto/test/second.js`);
  }
}