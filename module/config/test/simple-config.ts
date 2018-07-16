import * as assert from 'assert';

import { Test, Suite, BeforeEach, AfterEach } from '@travetto/test';

import { ConfigLoader } from '../src';

class DbConfig {
  name: string;
  connection: string;
  hosts: string[];
}

class TestConfig extends DbConfig {
  anonHosts = ['a', 'b'];
}

@Suite()
export class ConfigTest {

  envCopy: any;

  private reinit() {
    delete (ConfigLoader as any)['_initialized'];
    ConfigLoader.initialize();
  }

  @BeforeEach()
  before() {
    this.envCopy = { ...process.env };
    this.reinit();
  }

  @AfterEach()
  after() {
    process.env = this.envCopy;
  }

  @Test()
  async verifyBasic() {
    const conf = new TestConfig();
    ConfigLoader.bindTo(conf, 'db.mysql');
    assert(conf.name === 'Oscar');
  }

  @Test()
  async verifyEnv() {
    process.env.DB_MYSQL_NAME = 'Roger';
    this.reinit();

    const conf = new TestConfig();
    ConfigLoader.bindTo(conf, 'db.mysql');
    assert(conf.name === 'Roger');
  }

  @Test()
  async verifyNotdefined() {
    const conf = new TestConfig();
    ConfigLoader.bindTo(conf, 'model.mongo');

    // Default value from
    assert(conf.anonHosts === ['a', 'b']);

    process.env.MODEL_MONGO_ANONHOSTS = 'a,b,c,d';
    this.reinit();

    const newConf = new TestConfig();
    ConfigLoader.bindTo(newConf, 'model.mongo');

    // Default value from
    assert(newConf.anonHosts === ['a', 'b', 'c', 'd']);
  }
}