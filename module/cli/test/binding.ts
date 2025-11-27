import assert from 'node:assert';

import { AssertCheck, BeforeAll, Suite, Test } from '@travetto/test';
import { CliCommand, CliCommandSchemaUtil, CliFlag, CliParseUtil, ParsedState } from '@travetto/cli';
import { SchemaRegistryIndex } from '@travetto/schema';
import { Registry } from '@travetto/registry';

/**
 * My command
 */
@CliCommand()
class Entity {

  ids?: number[] = [];

  fun?: boolean;

  long?: string[];

  /**
   * My color
   *
   * @alias -l
   * @alias env.COLOREO
   */
  color?: 'green' | 'blue';

  /** My age */
  @CliFlag({ short: 'g' })
  age?: number;

  main(file: string, force: boolean, args?: string[]) { }
}

const get = async (...args: string[]) => CliParseUtil.parse(SchemaRegistryIndex.getConfig(Entity), args);
const unused = (state: ParsedState) => state.unknown;

@Suite()
export class SchemaBindingSuite {

  @AssertCheck()
  async checkArgs(args: string[], expected: unknown[], raw?: unknown[]) {
    const entity = new Entity();
    const parsed = await get(...args);
    const found = await CliCommandSchemaUtil.bindInput(entity, parsed);
    assert.deepStrictEqual(found, expected);
    if (raw) {
      assert.deepStrictEqual(unused(parsed), raw);
    }
  };


  @BeforeAll()
  async init() {
    await Registry.init();
  }

  @Test()
  async testFlags() {
    const entity = new Entity();
    await CliCommandSchemaUtil.bindInput(entity, await get('--age', '30'));
    assert(entity.age === 30);

    await CliCommandSchemaUtil.bindInput(entity, await get('-g', '40'));
    // @ts-ignore
    assert(entity.age === 40);

    const { all: parsed } = await get('--age=50');
    assert(parsed[0].type === 'flag');
    assert(parsed[0].fieldName === 'age');
    assert(parsed[0].value === '50');

    await CliCommandSchemaUtil.bindInput(entity, await get('--age=50'));
    assert(entity.age === 50);

    await CliCommandSchemaUtil.bindInput(entity, await get('--age'));
    assert(entity.age === undefined);

    await CliCommandSchemaUtil.bindInput(entity, await get('--age', '20', '-g', '20'));
    assert(entity.age === 20);

    await CliCommandSchemaUtil.bindInput(entity, await get('--age', '20', '-g'));
    assert(entity.age === undefined);

    await CliCommandSchemaUtil.bindInput(entity, await get('--age', '20', '-g', 'red'));
    assert(isNaN(entity.age));

    process.env.COLOREO = '100';
    await CliCommandSchemaUtil.bindInput(entity, await get('--color'));
    assert(entity.color === undefined);

    await CliCommandSchemaUtil.bindInput(entity, await get());
    assert(entity.color === '100');
  }

  @Test()
  async testSchema() {
    const schema = SchemaRegistryIndex.getConfig(Entity);
    assert(schema.title === 'My command');
    const color = schema.fields.color;
    assert(color.description === 'My color');
    assert(color.required?.active === false);
    assert(color.type === String);
    assert(color.aliases?.includes('env.COLOREO'));
    assert(color.aliases?.includes('-l'));
    assert(color.aliases?.includes('--color'));
    assert.deepStrictEqual(color.enum?.values?.toSorted(), ['blue', 'green']);

    const age = schema.fields.age;
    assert(age.description === 'My age');
    assert(age.required?.active === false);
    assert(age.type === Number);
    assert(age.aliases?.includes('-g'));
    assert(age.aliases?.includes('--age'));
  }

  @Test()
  async testBindArgs() {
    await this.checkArgs(['-g', '20', 'george'], ['george', undefined, undefined]);
    await this.checkArgs(['-g', '20', '--age', 'george'], [undefined, undefined, undefined]);
    await this.checkArgs(['-g', '20', 'george', '1'], ['george', true, undefined]);
    await this.checkArgs(['-g', '20', 'george', 'red'], ['george', false, undefined]);
    await this.checkArgs(['-g', '20', 'george', 'true', 'orange'], ['george', true, ['orange']]);
    await this.checkArgs(['-g', '20', 'george', 'true', '--', '--age', '20', 'orange'],
      ['george', true, undefined],
      ['--age', '20', 'orange']
    );
    await this.checkArgs(['-g', '20', 'george', 'true', '-z', '--gravy', '--', '--age', '20', 'orange'],
      ['george', true, undefined],
      ['-z', '--gravy', '--age', '20', 'orange']
    );
  }

  @Test()
  async bindNegativeNumbers() {

    const entity = new Entity();
    let state = await get('-i', '10', '-i', '20', 'george');

    await CliCommandSchemaUtil.bindInput(entity, state);
    let args = await CliCommandSchemaUtil.bindInput(entity, state);
    assert.deepStrictEqual(entity.ids, [10, 20]);
    assert.deepStrictEqual(args, ['george', undefined, undefined]);

    state = await get('-i', '-10', '--ids', '22', 'george', 'yes', '200');
    assert(state.all.find(x => x.type === 'flag' && x.input === '-i' && x.value === '-10'));

    await CliCommandSchemaUtil.bindInput(entity, state);
    args = await CliCommandSchemaUtil.bindInput(entity, state);
    assert.deepStrictEqual(args, ['george', true, ['200']]);
    assert.deepStrictEqual(entity.ids, [-10, 22]);
  }

  @Test()
  async testEnv() {
    let state = await get('george');
    assert(state.all.length === 1);
    assert(state.all[0].type === 'arg');

    process.env.COLOREO = 'green';

    state = await get('george');
    assert(state.all.length === 2);
    assert(state.all[0].type === 'flag');
    assert(state.all[0].input === 'env.COLOREO');
    assert(state.all[1].type === 'arg');
  }

  @Test()
  async testBoolean() {
    let state = await get('--fun');
    assert(state.all.length === 1);

    assert(state.all[0].type === 'flag');

    state = await get('--fun=0');
    assert(state.all.length === 1);

    assert(state.all[0].type === 'flag');
    assert(state.all[0].value === '0');

    state = await get('-f', '0');
    assert(state.all.length === 2);

    assert(state.all[0].type === 'flag');
    assert(state.all[0].value === true);

    assert(state.all[1].type === 'arg');
    assert(state.all[1].input === '0');

    state = await get('--no-fun');
    assert(state.all.length === 1);

    assert(state.all[0].type === 'flag');
  }

  @Test()
  async testLongArgs() {
    let state = await get('--long=hello');
    assert(state.all.length === 1);

    assert(state.all[0].type === 'flag');
    assert(state.all[0].value === 'hello');

    state = await get('--long=a=b=c=d', '--long', 'goodby');
    assert(state.all.length === 2);

    assert(state.all[0].type === 'flag');
    assert(state.all[0].value === 'a=b=c=d');

    assert(state.all[1].type === 'flag');
    assert(state.all[1].value === 'goodby');

    state = await get('--long=--hello,--gogo');
    assert(state.all.length === 1);

    assert(state.all[0].type === 'flag');
    assert(state.all[0].value === '--hello,--gogo');
  }
}