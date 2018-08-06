import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { Controller, ControllerRegistry } from '../src';

@Controller('/test')
class TestController {

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
  }
}