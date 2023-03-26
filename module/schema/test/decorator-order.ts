import assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Alias, Field, LongText, Required, Schema, SchemaRegistry, Specifier, Text } from '../__index__';

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
    assert.deepStrictEqual(schema.schema.text.specifiers?.sort(), ['text', 'long', 'weird'].sort());
  }

  @Test()
  async testSpecifiersRaw() {
    await SchemaRegistry.init();
    const schema = SchemaRegistry.getViewSchema(MyClass);
    assert.deepStrictEqual(schema.schema.text2.specifiers?.sort(), ['text', 'weirder'].sort());
    assert(schema.schema.text2.name === 'text2');
    assert(schema.schema.text2.required?.active === true);
  }
}