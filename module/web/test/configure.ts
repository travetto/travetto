import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { SchemaRegistry } from '@travetto/schema';

import { Controller, } from '../src/decorator/controller.ts';
import { Get } from '../src/decorator/endpoint.ts';
import { PathParam } from '../src/decorator/param.ts';
import { ControllerRegistry } from '../src/registry/controller.ts';

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
    const params = SchemaRegistry.getMethodSchema(ep.class, ep.name);
    assert(ep.method === 'get');
    assert(ep.name === 'getUser');
    assert(ep.endpoint === TestController.prototype.getUser);
    assert(ep.title === 'Get user by name');

    assert(ep.params.length === 1);

    assert(ep.params[0].name === 'name');
    assert(params[0].description === 'User name as a number');
  }
}