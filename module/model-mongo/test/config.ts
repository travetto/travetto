import assert from 'node:assert';

import { RootRegistry } from '@travetto/registry';
import { Suite, Test } from '@travetto/test';

import { MongoModelConfig } from '../src/config.ts';

@Suite()
class MongoConfigSuite {
  @Test()
  async simpleTest() {
    await RootRegistry.init();

    const config = new MongoModelConfig();
    assert(config);

    config.connectionString = 'mongodb+srv://user:password@hostname.com:3000/namespace';
    await config.postConstruct();

    assert(config.srvRecord);
    assert(config.username === 'user');
    assert(config.password === 'password');
    assert.deepEqual(config.hosts, ['hostname.com']);
    assert(config.port === 3000);
    assert(config.namespace === 'namespace');
  }

  @Test()
  async simpleTestWithDefaults() {
    await RootRegistry.init();

    const config = new MongoModelConfig();
    assert(config);

    config.connectionString = 'mongodb+srv://user:password@hostname.com:3000/namespace';
    config.srvRecord = false;
    await config.postConstruct();

    assert(!config.srvRecord);
  }
}