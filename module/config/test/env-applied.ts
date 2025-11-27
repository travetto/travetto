import assert from 'node:assert';

import { Test, Suite, BeforeAll } from '@travetto/test';
import { DependencyRegistryIndex } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { Env } from '@travetto/runtime';

import { NameConfig, TestConfig } from './shared.ts';

@Suite()
export class EnvConfigTest {

  @BeforeAll()
  async init() {
    Object.assign(process.env, {
      DB_MYSQL_NAME: 'Roger',
      DB_ANON_HOSTS: 'a,b,c,d',
      NAME_ACTIVE: 'false'
    });
    Env.TRV_RESOURCES.add('@#test/fixtures');
    await Registry.init();
  }

  @Test()
  async verifyBasicWithEnv() {
    const conf = await DependencyRegistryIndex.getInstance(TestConfig);
    assert(conf.name === 'Roger');
  }

  @Test()
  async verifyDefined() {
    const conf = await DependencyRegistryIndex.getInstance(TestConfig);

    // Default value from
    assert.deepStrictEqual(conf.anonHosts, ['a', 'b', 'c', 'd']);
  }

  @Test()
  async environmentOverrideFalse() {
    const conf = await DependencyRegistryIndex.getInstance(NameConfig);
    assert(conf.active === false);
    assert(conf.size === 23);
  }
}