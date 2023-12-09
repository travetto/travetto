import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { ObjectUtil } from '@travetto/base';

import { ControllerRegistry } from '../src/registry/controller';
import { Controller } from '../src/decorator/controller';
import { Patch } from '../src/decorator/endpoint';
import { CacheControl } from '../src/decorator/common';

@Controller('/test')
class TestController {
  @CacheControl('1s')
  @Patch('/a')
  async patch() { }

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
    assert(ObjectUtil.isFunction(cacher));
    assert(cacher() === 'max-age=1');

    const expires = ControllerRegistry.get(TestController).endpoints[0].headers['expires'];
    assert(ObjectUtil.isFunction(expires));
    assert(expires() === new Date(1000 + Date.now()).toUTCString());
  }

  @Test()
  async verifyBadMaxAge() {
    const cacher = ControllerRegistry.get(TestController).endpoints[1].headers['cache-control'];
    assert(ObjectUtil.isFunction(cacher));
    assert(cacher() === 'max-age=0,no-cache');

    const expires = ControllerRegistry.get(TestController).endpoints[1].headers['expires'];
    assert(!ObjectUtil.isFunction(expires));
    assert(expires === '-1');
  }
}