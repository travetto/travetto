import * as assert from 'assert';

import { YamlUtil } from '@travetto/yaml';
import { Test, Suite, BeforeEach, AfterEach } from '@travetto/test';

import { ConfigManager } from '../src/manager';
import { SimpleObject, Util } from '@travetto/base';

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

  envCopy: NodeJS.ProcessEnv;

  private async reinit() {
    delete ConfigManager['initialized'];
    await ConfigManager.init();
  }

  @BeforeEach()
  async before() {
    this.envCopy = { ...process.env };
    await this.reinit();
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
    await this.reinit();

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
    await this.reinit();

    const newConf = new TestConfig();
    ConfigManager.bindTo(newConf, 'model.mongo');

    // Default value from
    assert(newConf.anonHosts === ['a', 'b', 'c', 'd']);
  }

  @Test()
  async verifyTopLevelKeys() {
    ConfigManager.putAll(YamlUtil.parse(SAMPLE_YAML) as SimpleObject);
    console.log('Configuration', ConfigManager.get() as Record<string, string>);
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
    await this.reinit();

    const res = ConfigManager.bindTo(new NameConfig(), 'name');

    assert(res.active === false);
  }

  @Test()
  async testSecret() {
    await this.reinit();

    ConfigManager.putAll(YamlUtil.parse(`
--
config:
  redacted:
    - panda.user
  s3:
    secretAccessKey: bob
panda.user: bob
`) as SimpleObject);

    const all = ConfigManager.getSecure();
    assert(Util.isPlainObject(all.panda));
    assert(all.panda === { user: '***' });
    assert(Util.isPlainObject(all.config));
    assert(all.config.s3 === { secretAccessKey: '***' });
  }
}