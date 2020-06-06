import * as assert from 'assert';

import { YamlUtil } from '@travetto/yaml';
import { Test, Suite, BeforeEach, AfterEach } from '@travetto/test';

import { ConfigManager } from '../src/manager';

class DbConfig {
  name: string;
  connection: string;
  hosts: string[];
}

class NameConfig {
  active = false;
}

class TestConfig extends DbConfig {
  anonHosts = ['a', 'b'];
}

class Test2Config {
  values: number[] = [];
}

const SAMPLE_YAML = `
test:
  beta:
    values:
    - 2
    - 4
    - 6

test.alpha:
  values:
  - 1
  - 2
  - 3
`;

@Suite()
export class ManagerTest {

  envCopy: any;

  private reinit() {
    delete ConfigManager['initialized'];
    ConfigManager.init();
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
    ConfigManager.bindTo(conf, 'db.mysql');
    assert(conf.name === 'Oscar');
  }

  @Test()
  async verifyEnv() {
    process.env.DB_MYSQL_NAME = 'Roger';
    this.reinit();

    const conf = new TestConfig();
    ConfigManager.bindTo(conf, 'db.mysql');
    assert(conf.name === 'Roger');
  }

  @Test()
  async verifyNotDefined() {
    const conf = new TestConfig();
    ConfigManager.bindTo(conf, 'model.mongo');

    // Default value from
    assert(conf.anonHosts === ['a', 'b']);

    process.env.MODEL_MONGO_ANONHOSTS = 'a,b,c,d';
    this.reinit();

    const newConf = new TestConfig();
    ConfigManager.bindTo(newConf, 'model.mongo');

    // Default value from
    assert(newConf.anonHosts === ['a', 'b', 'c', 'd']);
  }

  @Test()
  async verifyTopLevelKeys() {
    ConfigManager.putAll(YamlUtil.parse(SAMPLE_YAML));
    console.log(ConfigManager.get());
    const conf = new Test2Config();
    ConfigManager.bindTo(conf, 'test.beta');
    assert(conf.values.length === 3);

    const conf2 = new Test2Config();
    ConfigManager.bindTo(conf2, 'test.alpha');
    assert(conf2.values.length === 3);
  }

  @Test()
  async environmentOverrideFalse() {
    process.env.NAME_ACTIVE = 'false';
    this.reinit();

    const res = ConfigManager.bindTo(new NameConfig(), 'name');

    assert(res.active === false);
  }

  @Test()
  testSecret() {
    this.reinit();

    ConfigManager.putAll(YamlUtil.parse(`
--
config:
  redacted:
    - panda.user
panda.user: bob`));

    const all = ConfigManager.getSecure();
    assert(all.panda?.user === '***');
  }
}