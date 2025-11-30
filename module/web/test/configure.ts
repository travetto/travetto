import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { Registry } from '@travetto/registry';
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
    await Registry.init();
  }

  @Test()
  async verifyConfiguration() {
    const config = ControllerRegistryIndex.getConfig(TestController);
    assert.ok(config);

    assert(config.class === TestController);
    assert(config.basePath === '/test');
    const schema = SchemaRegistryIndex.getConfig(TestController);
    assert(/.*Fun.*/.test(schema.description ?? ''));

    assert(config.endpoints.length === 1);

    const ep = config.endpoints[0];
    const { parameters: params } = SchemaRegistryIndex.getMethodConfig(ep.class, ep.methodName);
    assert(ep.httpMethod === 'GET');
    assert(ep.methodName === 'getUser');
    assert(ep.endpointFunction === TestController.prototype.getUser);

    const endpointSchema = SchemaRegistryIndex.getMethodConfig(TestController, ep.methodName);
    assert(endpointSchema.description === 'Get user by name');

    assert(ep.parameters.length === 1);

    assert(params[0].name === 'name');
    assert(params[0].description === 'User name as a number');
  }
}