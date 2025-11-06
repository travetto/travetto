import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RegistryV2 } from '@travetto/registry';
import { Controller, ControllerRegistryIndex, Get, PathParam } from '@travetto/web';
import { SchemaRegistryIndex } from '@travetto/schema';

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
  async getUser(@PathParam() name: number) {

  }
}

@Suite()
export class ConfigureTest {

  @BeforeAll()
  async init() {
    await RegistryV2.init();
  }

  @Test()
  async verifyConfiguration() {
    const config = ControllerRegistryIndex.getController(TestController);
    assert.ok(config);

    assert(config.class === TestController);
    assert(config.basePath === '/test');
    assert(/.*Fun.*/.test(config.title ?? ''));

    assert(config.endpoints.length === 1);

    const ep = config.endpoints[0];
    const { parameters: params } = SchemaRegistryIndex.getMethodConfig(ep.class, ep.name);
    assert(ep.httpMethod === 'GET');
    assert(ep.name === 'getUser');
    assert(ep.endpoint === TestController.prototype.getUser);
    assert(ep.title === 'Get user by name');

    assert(ep.params.length === 1);

    assert(ep.params[0].name === 'name');
    assert(params[0].description === 'User name as a number');
  }
}