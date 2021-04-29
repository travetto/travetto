import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { Controller, ControllerRegistry, Get, Path } from '../';
import { SchemaRegistry } from '@travetto/schema';

/**
 * Test Controller For Fun
 */
@Controller('/test')
class TestController {

  /**
   * Get user by name
   * @param name User name as a number
   */
  @Get('/user/:name')
  async getUser(@Path() name: number) {

  }
}

@Suite()
export class ConfigureTest {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async verifyConfiguration() {
    const config = ControllerRegistry.get(TestController);
    assert.ok(config);

    assert(config.class === TestController);
    assert(config.basePath === '/test');
    assert(/.*Fun.*/.test(config.title ?? ''));

    assert(config.endpoints.length === 1);

    const ep = config.endpoints[0];
    const params = SchemaRegistry.getMethodSchema(ep.class, ep.handlerName);
    assert(ep.method === 'get');
    assert(ep.handlerName === 'getUser');
    assert(ep.handler === TestController.prototype.getUser);
    assert(ep.title === 'Get user by name');

    assert(ep.params.length === 1);

    assert(ep.params[0].name === 'name');
    assert(params[0].description === 'User name as a number');
  }
}