import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { Suite, Test } from '@travetto/test';

import { Id, Model } from '../src/registry/decorator.ts';
import { ModelRegistryIndex } from '../src/registry/registry-index.ts';

@Model()
class DefaultModel {
  id: string;
  name: string;
}

@Model()
class CustomIdModel {
  @Id()
  code: string;
  name: string;
}

@Model()
class CustomGeneratorModel {
  @Id((): string => 'custom-id-value')
  identifier: string;
  name: string;
}

@Model()
class NaturalKeyModel {
  @Id(false)
  isbn: string;
  title: string;
}

@Suite('ModelIdSource Suite')
class ModelIdSourceSuite {
  @Test('Verify ModelRegistryIndex integration for default model')
  async testDefaultModel(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.getIdSource(DefaultModel);
    assert(source.field === 'id');
    assert(source.generator !== undefined);

    const generatedId = source.create();
    assert(typeof generatedId === 'string');
    assert(generatedId.length === 32);

    const item: DefaultModel = { id: 'test-123', name: 'Sample' };
    assert(source.getValue(item) === 'test-123');
    assert(source.getOptionalValue(item) === 'test-123');

    const emptyItem: Partial<DefaultModel> = { name: 'No Id' };
    assert(source.getOptionalValue(emptyItem) === undefined);
    assert.throws(() => source.getValue(emptyItem));

    source.setValue(emptyItem, 'assigned-id');
    assert(emptyItem.id === 'assigned-id');

    source.deleteValue(emptyItem);
    assert(emptyItem.id === undefined);

    const whereClause = source.getWhereClause('filter-id');
    assert.deepStrictEqual(whereClause, { id: 'filter-id' });
  }

  @Test('Verify custom id field')
  async testCustomIdField(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.getIdSource(CustomIdModel);
    assert(source.field === 'code');

    const item: CustomIdModel = { code: 'code-1', name: 'Item' };
    assert(source.getValue(item) === 'code-1');

    const whereClause = source.getWhereClause('code-99');
    assert.deepStrictEqual(whereClause, { code: 'code-99' });
  }

  @Test('Verify custom generator')
  async testCustomGenerator(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.getIdSource(CustomGeneratorModel);
    assert(source.field === 'identifier');
    assert(source.create() === 'custom-id-value');
  }

  @Test('Verify natural key')
  async testNaturalKey(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.getIdSource(NaturalKeyModel);
    assert(source.field === 'isbn');
    assert(source.generator === undefined);
  }
}
