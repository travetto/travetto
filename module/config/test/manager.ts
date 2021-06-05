import * as assert from 'assert';

import { YamlUtil } from '@travetto/yaml';
import { Test, Suite, BeforeEach, AfterEach } from '@travetto/test';
import { Util } from '@travetto/base';
import { BindUtil, ValidationResultError } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import { ConfigManager } from '../src/manager';
import { Config } from '../src/decorator';

@Config('ignore')
class NameConfig {
  active = false;
}

@Config('ignore')
class TestConfig {
  anonHosts = ['a', 'b'];
  name: string;
  connection: string;
  hosts: string[];
}

@Config('ignore')
class Test2Config {
  values: number[] = [];
}

@Config('ignore')
class CustomC {
  c?: number;
}

@Config('nested')
class Nested {
  user?: {
    age: number;
    height: number;
  };
}

@Config('generic')
class Generic {
  name?: string;
  props?: Record<string, unknown>;
}

@Config('config')
class SecureConfig {
  redacted: string[];
  s3: {
    secretAccessKey: string;
  };
}

@Config('panda')
class Panda {
  user: string;
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
nested:
  user: 
    age: 52
vague:
  name: bob
  props:
    person: 20
    age: true
    child:
      name: [1,2,3]
`;

@Suite()
export class ManagerTest {

  envCopy: NodeJS.ProcessEnv;

  async #reinit() {
    ConfigManager.reset();
    await ConfigManager.init();
  }

  #addConfig(yaml: string) {
    Util.deepAssign(ConfigManager['getStorage'](), BindUtil.expandPaths(YamlUtil.parse(yaml) as Record<string, unknown>), 'coerce');
  }

  @BeforeEach()
  async before() {
    this.envCopy = { ...process.env };
    await this.#reinit();
    await RootRegistry.init();
  }

  @AfterEach()
  after() {
    process.env = this.envCopy;
  }

  @Test()
  async verifyBasic() {
    const conf = ConfigManager.bindTo(TestConfig, new TestConfig(), 'db.mysql');
    assert(conf.name === 'Oscar');
  }

  @Test()
  async verifyEnv() {
    process.env.DB_MYSQL_NAME = 'Roger';
    await this.#reinit();

    const conf = ConfigManager.bindTo(TestConfig, new TestConfig(), 'db.mysql');
    assert(conf.name === 'Roger');
  }

  @Test()
  async verifyNotDefined() {
    const conf = new TestConfig();
    ConfigManager.bindTo(TestConfig, conf, 'model.mongo');

    // Default value from
    assert(conf.anonHosts === ['a', 'b']);

    process.env.MODEL_MONGO_ANONHOSTS = 'a,b,c,d';
    await this.#reinit();

    const newConf = ConfigManager.bindTo(TestConfig, new TestConfig(), 'model.mongo');

    // Default value from
    assert(newConf.anonHosts === ['a', 'b', 'c', 'd']);
  }

  @Test()
  async verifyTopLevelKeys() {
    this.#addConfig(SAMPLE_YAML);
    console.log('Configuration', ConfigManager.toJSON());

    const conf = ConfigManager.bindTo(Test2Config, new Test2Config(), 'test.beta');
    assert(conf.values.length === 3);

    const conf2 = ConfigManager.bindTo(Test2Config, new Test2Config(), 'test.alpha');
    assert(conf2.values.length === 3);
  }

  @Test()
  async environmentOverrideFalse() {
    process.env.NAME_ACTIVE = 'false';
    await this.#reinit();

    const res = ConfigManager.bindTo(NameConfig, new NameConfig(), 'name');

    assert(res.active === false);
  }

  @Test()
  async testSecret() {
    this.#addConfig(`
--
config:
  redacted:
    - panda.user
  s3:
    secretAccessKey: bob
panda.user: bob
`);

    await ConfigManager.install(Panda, new Panda(), 'panda');
    await ConfigManager.install(SecureConfig, new SecureConfig(), 'config');

    const all = ConfigManager.toJSON(true);
    console.log(all);
    assert(Util.isPlainObject(all.panda));
    assert(all.panda === { user: '**********' });
    assert(Util.isPlainObject(all.config));
    assert(all.config.s3 === { secretAccessKey: '**********' });
  }

  @Test()
  async bindTo() {
    process.env.A_B_C = '5';
    const res = ConfigManager.bindTo(CustomC, {}, 'a.b');
    assert(res.c === 5);

    process.env.A_B_C = '20';
    const res2 = ConfigManager.bindTo(CustomC, {}, 'a.b');
    assert(res2.c === 20);

    process.env.A_B_C = 'blob';
    const res3 = ConfigManager.bindTo(CustomC, {}, 'a.b');
    assert(Number.isNaN(res3.c));
  }

  @Test()
  async nestedBindTo() {
    this.#addConfig(SAMPLE_YAML);

    const res = ConfigManager.bindTo(Nested, {}, 'nested');
    assert.ok(res.user);
    assert(res.user.age === 52);
    assert(res.user.height === undefined);

    await assert.rejects(() => DependencyRegistry.getInstance(Nested), ValidationResultError);

    this.#addConfig('nested.user.height: 20');

    await assert.doesNotReject(() => DependencyRegistry.getInstance(Nested));
  }

  @Test()
  async genericBind() {
    process.env.VAGUE_PROPS_COLOR = '2,3,4';
    process.env.VAGUE_PROPS_SUPERPOWER = 'green';

    this.#addConfig(SAMPLE_YAML);

    const res = ConfigManager.bindTo(Generic, new Generic(), 'vague');
    assert(res.name === 'bob');
    assert.ok(res.props);
    assert(res.props.person === 20);
    assert(res.props.age === true);
    assert(res.props.child === { name: [1, 2, 3] });
    assert(res.props.superpower === 'green');
    assert(res.props.color === ['2', '3', '4']);
  }
}