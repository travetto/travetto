import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { Controller, ControllerRegistry, Get } from '../';

/**
 * Test Controller For Fun
 */
@Controller('/test')
class TestController {

  /**
   * Get user by name
   * @param {number} name User name as a number
   */
  @Get('/user/:name')
  async getUser() {

  }
}

@Suite()
export class ConfigureTest {

  @BeforeAll()
  async init() {
    await ControllerRegistry.init();
  }

  @Test()
  async verifyConfiguration() {
    const config = ControllerRegistry.get(TestController);
    assert.ok(config);

    assert(config.class === TestController);
    assert(config.basePath === '/test');
    assert(/.*Fun.*/.test(config.title || ''));

    assert(config.endpoints.length === 1);

    const ep = config.endpoints[0];
    assert(ep.method === 'get');
    assert(ep.handlerName === 'getUser');
    assert(ep.handler === TestController.prototype.getUser);
    assert(ep.title === 'Get user by name');

    assert(Object.keys(ep.params).length === 1);

    assert(ep.params.name.name === 'name');
    assert(ep.params.name.type === Number);
    assert(ep.params.name.description === 'User name as a number');

    assert(ep.filters.length === 1);

    const testParams: any = {
      params: {
        name: '55'
      }
    };

    await ep.filters[0](testParams, null as any);
    // console.log(testParams);

    assert(testParams.params.name === 55);
  }
}