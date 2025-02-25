import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { TimeUtil } from '@travetto/runtime';

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

  @Test()
  async verifyMaxAge() {
    const cacher = ControllerRegistry.get(TestController).endpoints[0].headers['cache-control'];
    assert(typeof cacher !== 'function');
    assert(cacher === 'max-age=1');

    const expires = ControllerRegistry.get(TestController).endpoints[0].headers['expires'];
    assert(typeof expires === 'function');
    assert(expires() === TimeUtil.fromNow('1s').toUTCString());
  }

  @Test()
  async verifyBadMaxAge() {
    const cacher = ControllerRegistry.get(TestController).endpoints[1].headers['cache-control'];
    assert(typeof cacher !== 'function');
    assert(cacher === 'max-age=0,no-cache');

    const expires = ControllerRegistry.get(TestController).endpoints[1].headers['expires'];
    assert(typeof expires === 'string');
    assert(expires === '-1');
  }

  @Test()
  async setMultipleHeaderS() {
    const { headers } = ControllerRegistry.get(TestController).endpoints[1];
    assert(headers['cache-control']);
    assert(headers['expires']);
    assert(headers['content-type']);
  }
}