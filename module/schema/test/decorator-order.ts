import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { Alias, Field, LongText, Required, Specifier, Text } from '../src/decorator/field.ts';
import { Schema } from '../src/decorator/schema.ts';
import { SchemaRegistry } from '../src/service/registry.ts';

@Schema()
class MyClass {

  /** @alias bob */
  @Alias('bob1', 'bob2')
  field: string;

  @LongText()
  @Specifier('weird')
  text: string;

  @Text()
  @Required()
  @Field(String, { specifiers: ['weirder'], required: { active: false } })
  text2: string;
}

@Suite()
export class DecoratorOrderSuite {
  @Test()
  async testAlias() {
    await SchemaRegistry.init();
    const schema = SchemaRegistry.getViewSchema(MyClass);
    assert.deepStrictEqual(schema.schema.field.aliases, ['bob', 'bob1', 'bob2']);
  }

  @Test()
  async testSpecifiers() {
    await SchemaRegistry.init();
    const schema = SchemaRegistry.getViewSchema(MyClass);
    assert.deepStrictEqual(schema.schema.text.specifiers?.toSorted(), ['text', 'long', 'weird'].toSorted());
  }

  @Test()
  async testSpecifiersRaw() {
    await SchemaRegistry.init();
    const schema = SchemaRegistry.getViewSchema(MyClass);
    assert.deepStrictEqual(schema.schema.text2.specifiers?.toSorted(), ['text', 'weirder'].toSorted());
    assert(schema.schema.text2.name === 'text2');
    assert(schema.schema.text2.required?.active === true);
  }
}