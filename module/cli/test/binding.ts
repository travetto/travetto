import assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { CliCommand, CliFlag } from '../src/decorators';
import { CliCommandSchemaUtil } from '../src/schema';


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

  @CliFlag({ short: 'g', desc: 'My age' })
  age?: number;

  main(file: string, force: boolean, args?: string[]) { }
}

const get = (...args: string[]) => CliCommandSchemaUtil.parse(Entity, args);
const unused = CliCommandSchemaUtil.getUnusedArgs.bind(CliCommandSchemaUtil);
const checkArgs = async (args: string[], expected: unknown[], raw?: unknown[]) => {
  const entity = new Entity();
  const parsed = await get(...args);
  await CliCommandSchemaUtil.bindFlags(entity, parsed);
  const found = await CliCommandSchemaUtil.bindArgs(entity, parsed);
  assert.deepStrictEqual(found, expected);
  if (raw) {
    assert.deepStrictEqual(unused(parsed), raw);
  }
};

@Suite()
export class SchemaBindingSuite {
  @Test()
  async testFlags() {
    const entity = new Entity();
    await CliCommandSchemaUtil.bindFlags(entity, await get('--age', '30'));
    assert(entity.age === 30);

    await CliCommandSchemaUtil.bindFlags(entity, await get('-g', '40'));
    // @ts-ignore
    assert(entity.age === 40);

    const parsed = await get('--age=50');
    assert(parsed[0].type === 'flag');
    assert(parsed[0].fieldName === 'age');
    assert(parsed[0].value === '50');

    await CliCommandSchemaUtil.bindFlags(entity, await get('--age=50'));
    assert(entity.age === 50);

    await CliCommandSchemaUtil.bindFlags(entity, await get('--age'));
    assert(entity.age === undefined);

    await CliCommandSchemaUtil.bindFlags(entity, await get('--age', '20', '-g', '20'));
    assert(entity.age === 20);

    await CliCommandSchemaUtil.bindFlags(entity, await get('--age', '20', '-g'));
    assert(entity.age === undefined);

    await CliCommandSchemaUtil.bindFlags(entity, await get('--age', '20', '-g', 'red'));
    assert(isNaN(entity.age));

    process.env.COLOREO = '100';
    await CliCommandSchemaUtil.bindFlags(entity, await get('--color'));
    assert(entity.color === undefined);

    await CliCommandSchemaUtil.bindFlags(entity, await get());
    assert(entity.color === '100');
  }

  @Test()
  async testSchema() {
    const schema = await CliCommandSchemaUtil.getSchema(Entity);
    assert(schema.title === 'My command');
    const color = schema.flags.find(x => x.name === 'color')!;
    assert(color.description === 'My color');
    assert(color.required !== true);
    assert(color.type === 'string');
    assert(color.envVars?.includes('COLOREO'));
    assert(color.flagNames?.includes('-l'));
    assert(color.flagNames?.includes('--color'));
    assert.deepStrictEqual(color.choices?.sort(), ['blue', 'green']);

    const age = schema.flags.find(x => x.name === 'age')!;
    assert(age.description === 'My age');
    assert(age.required !== true);
    assert(age.type === 'number');
    assert(age.flagNames?.includes('-g'));
    assert(age.flagNames?.includes('--age'));
  }

  @Test()
  async testBindArgs() {
    await checkArgs(['-g', '20', 'george'], ['george', undefined, undefined]);
    await checkArgs(['-g', '20', '--age', 'george'], [undefined, undefined, undefined]);
    await checkArgs(['-g', '20', 'george', '1'], ['george', true, undefined]);
    await checkArgs(['-g', '20', 'george', 'red'], ['george', false, undefined]);
    await checkArgs(['-g', '20', 'george', 'true', 'orange'], ['george', true, ['orange']]);
    await checkArgs(['-g', '20', 'george', 'true', '--', '--age', '20', 'orange'],
      ['george', true, undefined],
      ['--age', '20', 'orange']
    );

    await checkArgs(['-g', '20', 'george', 'true', '-z', '--gravy', '--', '--age', '20', 'orange'],
      ['george', true, undefined],
      ['-z', '--gravy', '--age', '20', 'orange']
    );
  }

  @Test()
  async bindNegativeNumbers() {

    const entity = new Entity();
    let parsed = await get('-i', '10', '-i', '20', 'george');

    await CliCommandSchemaUtil.bindFlags(entity, parsed);
    let args = await CliCommandSchemaUtil.bindArgs(entity, parsed);
    assert.deepStrictEqual(entity.ids, [10, 20]);
    assert.deepStrictEqual(args, ['george', undefined, undefined]);

    parsed = await get('-i', '-10', '--ids', '22', 'george', 'yes', '200');
    assert(parsed.find(x => x.type === 'flag' && x.input === '-i' && x.value === '-10'));

    await CliCommandSchemaUtil.bindFlags(entity, parsed);
    args = await CliCommandSchemaUtil.bindArgs(entity, parsed);
    assert.deepStrictEqual(args, ['george', true, ['200']]);
    assert.deepStrictEqual(entity.ids, [-10, 22]);
  }

  @Test()
  async testEnv() {
    let args = await get('george');
    assert(args.length === 1);
    assert(args[0].type === 'arg');

    process.env.COLOREO = 'green';

    args = await get('george');
    assert(args.length === 2);
    assert(args[0].type === 'flag');
    assert(args[0].input === 'env.COLOREO');
    assert(args[1].type === 'arg');
  }

  @Test()
  async testBoolean() {
    let args = await get('--fun');
    assert(args.length === 1);

    assert(args[0].type === 'flag');
    assert(args[0].value === true);

    args = await get('--fun=0');
    assert(args.length === 1);

    assert(args[0].type === 'flag');
    assert(args[0].value === '0');

    args = await get('-f', '0');
    assert(args.length === 2);

    assert(args[0].type === 'flag');
    assert(args[0].value === true);

    assert(args[1].type === 'arg');
    assert(args[1].input === '0');

    args = await get('--no-fun');
    assert(args.length === 1);

    assert(args[0].type === 'flag');
    assert(args[0].value === false);
  }

  @Test()
  async testLongArgs() {
    let args = await get('--long=hello');
    assert(args.length === 1);

    assert(args[0].type === 'flag');
    assert(args[0].value === 'hello');

    args = await get('--long=a=b=c=d', '--long', 'goodby');
    assert(args.length === 2);

    assert(args[0].type === 'flag');
    assert(args[0].value === 'a=b=c=d');

    assert(args[1].type === 'flag');
    assert(args[1].value === 'goodby');

    args = await get('--long=--hello,--gogo');
    assert(args.length === 1);

    assert(args[0].type === 'flag');
    assert(args[0].value === '--hello,--gogo');
  }
}