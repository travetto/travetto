import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Alias, Field, LongText, Required, Schema, SchemaRegistryIndex, Specifier, Text } from '@travetto/schema';
import { Registry } from '@travetto/registry';

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
  @Field({ type: String }, { specifiers: ['weirder'], required: { active: false } })
  text2: string;
}

@Suite()
export class DecoratorOrderSuite {
  @Test()
  async testAlias() {
    await Registry.init();
    const fields = SchemaRegistryIndex.get(MyClass).getSchema();
    assert.deepStrictEqual(fields.field.aliases, ['bob', 'bob1', 'bob2']);
  }

  @Test()
  async testSpecifiers() {
    await Registry.init();
    const fields = SchemaRegistryIndex.get(MyClass).getSchema();
    assert.deepStrictEqual(fields.text.specifiers?.toSorted(), ['text', 'long', 'weird'].toSorted());
  }

  @Test()
  async testSpecifiersRaw() {
    await Registry.init();
    const fields = SchemaRegistryIndex.get(MyClass).getSchema();
    assert.deepStrictEqual(fields.text2.specifiers?.toSorted(), ['text', 'weirder'].toSorted());
    assert(fields.text2.name === 'text2');
    assert(fields.text2.required?.active === true);
  }
}