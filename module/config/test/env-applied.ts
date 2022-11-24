import assert from 'assert';

import { Test, Suite, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import { NameConfig, TestConfig } from './shared';

@Suite()
export class EnvConfigTest {

  @BeforeAll()
  async init() {
    Object.assign(process.env, {
      DB_MYSQL_NAME: 'Roger',
      DB_ANON_HOSTS: 'a,b,c,d',
      NAME_ACTIVE: 'false'
    });
    await RootRegistry.init();
  }

  @Test()
  async verifyBasicWithEnv() {
    const conf = await DependencyRegistry.getInstance(TestConfig);
    assert(conf.name === 'Roger');
  }

  @Test()
  async verifyDefined() {
    const conf = await DependencyRegistry.getInstance(TestConfig);

    // Default value from
    assert.deepStrictEqual(conf.anonHosts, ['a', 'b', 'c', 'd']);
  }

  @Test()
  async environmentOverrideFalse() {
    const conf = await DependencyRegistry.getInstance(NameConfig);
    assert(conf.active === false);
  }
}