import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Alias, Field, LongText, Required, Schema, SchemaRegistryIndex, Specifier, Text } from '@travetto/schema';
import { RegistryV2 } from '@travetto/registry';

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
    await RegistryV2.init();
    const schema = SchemaRegistryIndex.getSchemaConfig(MyClass);
    assert.deepStrictEqual(schema.field.aliases, ['bob', 'bob1', 'bob2']);
  }

  @Test()
  async testSpecifiers() {
    await RegistryV2.init();
    const schema = SchemaRegistryIndex.getSchemaConfig(MyClass);
    assert.deepStrictEqual(schema.text.specifiers?.toSorted(), ['text', 'long', 'weird'].toSorted());
  }

  @Test()
  async testSpecifiersRaw() {
    await RegistryV2.init();
    const schema = SchemaRegistryIndex.getSchemaConfig(MyClass);
    assert.deepStrictEqual(schema.text2.specifiers?.toSorted(), ['text', 'weirder'].toSorted());
    assert(schema.text2.name === 'text2');
    assert(schema.text2.required?.active === true);
  }
}