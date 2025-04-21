import assert from 'node:assert';

import { Test, Suite, BeforeEach } from '@travetto/test';
import { ValidationResultError } from '@travetto/schema';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { Env } from '@travetto/runtime';

import { ConfigurationService } from '../src/service.ts';
import { Config } from '../src/decorator.ts';
import { ConfigSource } from '../src/source/types.ts';
import { MemoryConfigSource } from '../src/source/memory.ts';

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

@Config('props')
class Properties {
  multiline?: string;
}

class Setup {
  @InjectableFactory()
  static getMemoryConfig(): ConfigSource {
    return new MemoryConfigSource('override', {
      test: { beta: { values: [2, 4, 5] } },
      'test.alpha': {
        values: [1, 2, 3]
      },
      nested: { user: { age: 52 } },
      vague: {
        name: 'bob',
        props: {
          person: 20,
          age: true,
          child: { name: [1, 2, 3] }
        }
      }
    }, 1000);
  }
}

@Suite()
export class ManagerTest {

  config: ConfigurationService;

  @BeforeEach()
  async before() {
    Env.TRV_RESOURCES.add('@#test/fixtures');
    await RootRegistry.init();
    this.config = await DependencyRegistry.getInstance(ConfigurationService);
  }

  @Test()
  async verifyBasic() {
    const conf = await this.config.bindTo(TestConfig, new TestConfig(), 'db.mysql', false);
    assert(conf.name === 'Oscar');
  }

  @Test()
  async verifyTopLevelKeys() {
    const conf = await this.config.bindTo(Test2Config, new Test2Config(), 'test.beta', false);
    assert(conf.values.length === 3);

    const conf2 = await this.config.bindTo(Test2Config, new Test2Config(), 'test.alpha', false);
    assert(conf2.values.length === 3);
  }

  @Test()
  async nestedBindTo() {
    const result = await this.config.bindTo(Nested, {}, 'nested', false);
    assert.ok(result.user);
    assert(result.user.age === 52);
    assert(result.user.height === undefined);

    await assert.rejects(() => DependencyRegistry.getInstance(Nested), ValidationResultError);
  }

  @Test()
  async genericBind() {
    const result = await this.config.bindTo(Generic, new Generic(), 'vague', false);
    assert(result.name === 'bob');
    assert.ok(result.props);
    assert(result.props.person === 20);
    assert(result.props.age === true);
    assert.deepStrictEqual(result.props.child, { name: [1, 2, 3] });
    assert.deepStrictEqual(result.props.jsonColor, ['2', '3', '4']);
    assert.deepStrictEqual(result.props.propsColor, '2,3,4');
    assert(result.props.superpower === 'green');
  }

  @Test()
  async propsMultiline() {
    const result = await this.config.bindTo(Properties, new Properties(), 'props', false);
    assert(result.multiline);
    assert(result.multiline === 'hello my name is bob');
  }
}