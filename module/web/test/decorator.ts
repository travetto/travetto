import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { Class } from '@travetto/runtime';
import { CacheControl, Controller, ControllerRegistryIndex, Patch, SetHeaders } from '@travetto/web';

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
    await Registry.init();
  }

  getEndpoint(cls: Class, idx: number) {
    return ControllerRegistryIndex.getConfig(cls).endpoints[idx];
  }

  @Test()
  async verifyMaxAge() {
    const endpoint = this.getEndpoint(TestController, 0);
    assert(endpoint.responseContext?.cacheableAge === 1);
    assert(endpoint.responseContext?.isPrivate !== true);
    assert(!endpoint.finalizedResponseHeaders?.has('Cache-Control'));
  }

  @Test()
  async verifyBadMaxAge() {
    const endpoint = this.getEndpoint(TestController, 1);
    assert(!endpoint.finalizedResponseHeaders.has('Cache-Control'));
    assert(endpoint.responseContext?.cacheableAge === 0);
  }

  @Test()
  async setMultipleHeaderS() {
    const { finalizedResponseHeaders: headers } = this.getEndpoint(TestController, 1);
    assert(!headers.has('Cache-Control'));
    assert(headers.has('Content-Type'));
    assert(headers?.get('Content-Type') === '20');
  }
}