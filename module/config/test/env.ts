import * as assert from 'assert';

import { Test, Suite, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import { TestConfig } from './shared';

@Suite()
export class EnvConfigTest {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async verifyBasic() {
    await this.init();
    const conf = await DependencyRegistry.getInstance(TestConfig);
    assert(conf.name === 'Oscar');
  }

  @Test()
  async verifyNotDefined() {
    await this.init();
    const conf = await DependencyRegistry.getInstance(TestConfig);

    // Default value from
    assert.deepStrictEqual(conf.anonHosts, ['a', 'b']);
  }
}