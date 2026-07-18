import assert from 'node:assert';

import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { Env } from '@travetto/runtime';
import { BeforeAll, Suite, Test } from '@travetto/test';

import { TestConfig } from './shared.ts';

@Suite()
export class EnvConfigTest {
  @BeforeAll()
  async init() {
    Env.TRV_RESOURCES.add('@#test/fixtures');
    await Registry.init();
  }

  @Test()
  async verifyBasic() {
    await this.init();
    const conf = await DependencyRegistryIndex.getInstance(TestConfig);
    assert(conf.name === 'Oscar');
  }

  @Test()
  async verifyNotDefined() {
    await this.init();
    const conf = await DependencyRegistryIndex.getInstance(TestConfig);

    // Default value from
    assert.deepStrictEqual(conf.anonHosts, ['a', 'b']);
  }
}
