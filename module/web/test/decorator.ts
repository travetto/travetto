import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { Class, TimeUtil } from '@travetto/runtime';

import { EndpointConfig } from '../src/registry/types.ts';
import { ReturnValueConfig, ReturnValueInterceptor } from '../src/interceptor/return-value.ts';
import { ControllerRegistry } from '../src/registry/controller.ts';
import { Controller } from '../src/decorator/controller.ts';
import { Patch } from '../src/decorator/endpoint.ts';
import { CacheControl, SetHeaders } from '../src/decorator/common.ts';
import { HttpHeaders } from '../src/types/headers.ts';

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

  getHeaders(ep: EndpointConfig): HttpHeaders {
    const configs = (ep.interceptorConfigs ?? [])
      .filter((x): x is [Class, ReturnValueConfig] => x[0] === ReturnValueInterceptor)
      .map(x => x[1]);

    return new HttpHeaders().setFunctionalHeaders(...configs.map(x => x.headers));
  }

  @Test()
  async verifyMaxAge() {
    const headers = this.getHeaders(ControllerRegistry.get(TestController).endpoints[0]);
    const cacher = headers.get('Cache-Control');
    assert(typeof cacher !== 'function');
    assert(cacher === 'max-age=1');

    const expires = headers.get('Expires');
    assert(expires === TimeUtil.fromNow('1s').toUTCString());
  }

  @Test()
  async verifyBadMaxAge() {
    const headers = this.getHeaders(ControllerRegistry.get(TestController).endpoints[1]);
    const cacher = headers.get('Cache-Control');
    assert(typeof cacher !== 'function');
    assert(cacher === 'max-age=0,no-cache');

    const expires = headers.get('Expires');
    assert(typeof expires === 'string');
    assert(expires === '-1');
  }

  @Test()
  async setMultipleHeaderS() {
    const headers = this.getHeaders(ControllerRegistry.get(TestController).endpoints[1]);
    assert(headers.has('Cache-Control'));
    assert(headers.has('Expires'));
    assert(headers.has('Content-Type'));
  }
}