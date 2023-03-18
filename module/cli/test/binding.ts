import assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { CliCommand, CliFlag } from '../src/decorators';
import { CliCommandSchemaUtil } from '../src/schema';

/**
 * My command
 */
@CliCommand()
class Entity {

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

@Suite()
export class SchemaBindingSuite {
  @Test()
  async testFlags() {
    const entity = new Entity();
    await CliCommandSchemaUtil.bindFlags(entity, ['--age', '30']);
    assert(entity.age === 30);

    await CliCommandSchemaUtil.bindFlags(entity, ['-g', '40']);
    assert(entity.age === 40);

    await CliCommandSchemaUtil.bindFlags(entity, ['--age=50']);
    assert(entity.age === 50);

    await CliCommandSchemaUtil.bindFlags(entity, ['--age']);
    assert(entity.age === null);

    await CliCommandSchemaUtil.bindFlags(entity, ['--age', '20', '-g', '20']);
    assert(entity.age === 20);

    await CliCommandSchemaUtil.bindFlags(entity, ['--age', '20', '-g']);
    assert(entity.age === null);

    await CliCommandSchemaUtil.bindFlags(entity, ['--age', '20', '-g', 'red']);
    assert(isNaN(entity.age));

    process.env.COLOREO = '100';
    await CliCommandSchemaUtil.bindFlags(entity, ['--color']);
    assert(entity.color === null);

    await CliCommandSchemaUtil.bindFlags(entity, []);
    assert(entity.color === '100');
  }

  @Test()
  async testSchema() {
    const entity = new Entity();
    const schema = await CliCommandSchemaUtil.getSchema(entity);
    assert(schema.title === 'My command');
    const color = schema.flags.find(x => x.name === 'color')!;
    assert(color.description === 'My color');
    assert(color.required !== true);
    assert(color.type === 'string');
    assert(color.envVars?.includes('COLOREO'));
    assert(color.flagNames?.includes('-l'));
    assert(color.flagNames?.includes('--color'));
    assert.deepStrictEqual(color.choices, ['green', 'blue']);

    const age = schema.flags.find(x => x.name === 'age')!;
    assert(age.description === 'My age');
    assert(age.required !== true);
    assert(age.type === 'number');
    assert(age.flagNames?.includes('-g'));
    assert(age.flagNames?.includes('--age'));
  }

  @Test()
  async testBindArgs() {
    let found: unknown[] = [];
    let unknown: string[] = [];
    let remaining: string[] = [];

    const entity = new Entity();

    remaining = await CliCommandSchemaUtil.bindFlags(entity, ['-g', '20', 'george']);
    [found,] = await CliCommandSchemaUtil.bindArgs(entity, remaining);
    assert.deepStrictEqual(found, ['george', undefined, []]);

    remaining = await CliCommandSchemaUtil.bindFlags(entity, ['-g', '20', '--age', 'george']);
    [found,] = await CliCommandSchemaUtil.bindArgs(entity, remaining);
    assert.deepStrictEqual(found, [undefined, undefined, []]);

    remaining = await CliCommandSchemaUtil.bindFlags(entity, ['-g', '20', 'george', '1']);
    [found,] = await CliCommandSchemaUtil.bindArgs(entity, remaining);
    assert.deepStrictEqual(found, ['george', true, []]);

    remaining = await CliCommandSchemaUtil.bindFlags(entity, ['-g', '20', 'george', 'red']);
    [found,] = await CliCommandSchemaUtil.bindArgs(entity, remaining);
    assert.deepStrictEqual(found, ['george', false, []]);

    remaining = await CliCommandSchemaUtil.bindFlags(entity, ['-g', '20', 'george', 'true', 'orange']);
    [found,] = await CliCommandSchemaUtil.bindArgs(entity, remaining);
    assert.deepStrictEqual(found, ['george', true, ['orange']]);

    remaining = await CliCommandSchemaUtil.bindFlags(entity, ['-g', '20', 'george', 'true', '--', '--age', '20', 'orange']);
    [found, unknown] = await CliCommandSchemaUtil.bindArgs(entity, remaining);
    assert.deepStrictEqual(found, ['george', true, []]);
    assert.deepStrictEqual(unknown, ['--', '--age', '20', 'orange']);
  }
}