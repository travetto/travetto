import * as assert from 'assert';
import * as yaml from 'js-yaml';

import { Test, Suite, BeforeEach, AfterEach } from '@travetto/test';

import { ConfigLoader } from '../src/service/loader';
import { ConfigMap } from '../src/service/map';

class DbConfig {
  name: string;
  connection: string;
  hosts: string[];
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

  @Test()
  async verifyTopLevelKeys() {
    yaml.safeLoadAll(SAMPLE_YAML, (doc: any) => (ConfigLoader as any).map.putAll(doc));
    const conf = new Test2Config();
    ConfigLoader.bindTo(conf, 'test.beta');
    assert(conf.values.length === 3);

    const conf2 = new Test2Config();
    ConfigLoader.bindTo(conf2, 'test.alpha');
    assert(conf2.values.length === 3);
  }

  @Test()
  async breakDownKeys() {
    const data = yaml.safeLoad(`
a.b.c:
  - 1
  - 2
  - 3
a.b:
   d: name
a:
  e:
    g: test`);

    const broken: any = ConfigMap.breakDownKeys(data);
    assert(broken['a.b.c'] === undefined);
    assert(broken['a.b'] === undefined);

    assert.ok(broken.a);
    assert.ok(broken.a.b);
    assert.ok(broken.a.b.c);
    assert(broken.a.b.c.length === 3);

    assert(broken.a.b.d === 'name');

    assert(broken.a.e.g === 'test');
  }
}