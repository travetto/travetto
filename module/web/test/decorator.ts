import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { Class } from '@travetto/runtime';

import { ControllerRegistry } from '../src/registry/controller.ts';
import { Controller } from '../src/decorator/controller.ts';
import { Patch } from '../src/decorator/endpoint.ts';
import { CacheControl, SetHeaders } from '../src/decorator/common.ts';

@Controller('/test')
class TestController {
  @CacheControl('1s')
  @Patch('/a')
  async patch() { }

  @SetHeaders({ 'Content-Type': '20' })
  @CacheControl('500ms')
  @Patch('/b')
  async patchSmaller() { }
}

@Suite()
export class ConfigureTest {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  getHeaders(cls: Class, idx: number) {
    return ControllerRegistry.get(cls).endpoints[idx].responseHeaderMap;
  }

  @Test()
  async verifyMaxAge() {
    const headers = this.getHeaders(TestController, 0);
    assert(headers.has('Cache-Control'));

    const cacher = headers.get('Cache-Control');
    assert(typeof cacher !== 'function');
    assert(cacher === 'max-age=1');
  }

  @Test()
  async verifyBadMaxAge() {
    const headers = this.getHeaders(TestController, 1);
    assert(headers.has('Cache-Control'));

    const cacher = headers.get('Cache-Control');
    assert(typeof cacher !== 'function');
    assert(cacher === 'no-cache,max-age=0');
  }

  @Test()
  async setMultipleHeaderS() {
    const headers = this.getHeaders(TestController, 1);
    assert(headers.has('Cache-Control'));
    assert(headers.has('Content-Type'));
  }
}