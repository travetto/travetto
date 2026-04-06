import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { Schema, SchemaRegistryIndex } from '@travetto/schema';

@Schema()
class GenericItem {
  name: string;
}

interface GenericList<T> {
  items: T[];
}

@Schema()
class GenericContainer {
  value: GenericList<GenericItem>;
}

@Suite()
class GenericInstantiationSuite {

  @BeforeAll()
  ready() {
    return Registry.init();
  }

  @Test()
  async testGenericInstantiation() {
    const fields = SchemaRegistryIndex.get(GenericContainer).getFields();
    assert(fields.value);

    const valueConfig = SchemaRegistryIndex.get(fields.value.type).getFields();
    assert(valueConfig.items);
    assert(valueConfig.items.array);
    assert(valueConfig.items.type === GenericItem);
  }
}