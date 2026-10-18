import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { castTo } from '@travetto/runtime';
import { Schema, SchemaValidator, ValidationResultError } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

import { IdGenerator, Model } from '../src/registry/decorator.ts';
import { ModelRegistryIndex } from '../src/registry/registry-index.ts';
import type { ModelId, OptionalId, PartialWithId } from '../src/types/model.ts';
import { ModelCrudUtil } from '../src/util/crud.ts';
import { CustomIdModel } from '../support/test/crud.ts';

@Model('model-id-default')
class DefaultModel {
  id: ModelId;
  name: string;
}

@Model('model-id-custom-generator')
@IdGenerator((): string => 'custom-id-value')
class CustomGeneratorModel {
  identifier: ModelId;
  name: string;
}

@Model('model-id-subclass')
class SubclassCustomModel extends CustomGeneratorModel {
  extra: string;
}

@Model('model-id-auto-discovered')
class AutoDiscoveredIdModel {
  isbn: ModelId;
  title: string;
}

@Schema()
class InvalidMissingIdModel {
  name: string;
}

@Schema()
class PlainIdModel {
  id: string;
}

@Suite('ModelIdSource Suite')
class ModelIdSourceSuite {
  @Test('Verify ModelRegistryIndex integration for default model')
  async testDefaultModel(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.get(DefaultModel).idSource;
    assert(source.field === 'id');

    const generatedId = ModelRegistryIndex.getConfig(DefaultModel).idGenerator();
    assert(typeof generatedId === 'string');
    assert(generatedId.length === 32);

    const item: DefaultModel = { id: 'test-123', name: 'Sample' };
    assert(source.get(item) === 'test-123');
    assert(source.get(item, { optional: true }) === 'test-123');

    const emptyItem: OptionalId<DefaultModel> = { name: 'No Id' };
    assert(source.get(emptyItem, { optional: true }) === undefined);
    assert.throws(() => source.get(emptyItem));

    source.set(emptyItem, 'assigned-id');
    assert(emptyItem.id === 'assigned-id');

    source.clear(emptyItem);
    assert(emptyItem.id === undefined);

    const whereClause = source.where('filter-id');
    assert.deepStrictEqual(whereClause, { id: 'filter-id' });
  }

  @Test('Verify custom id field')
  async testCustomIdField(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.get(CustomIdModel).idSource;
    assert(source.field === 'customId');

    const item: CustomIdModel = { customId: 'code-1', name: 'Item' };
    assert(source.get(item) === 'code-1');

    const whereClause = source.where('code-99');
    assert.deepStrictEqual(whereClause, { customId: 'code-99' });
  }

  @Test('Verify custom generator')
  async testCustomGenerator(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.get(CustomGeneratorModel).idSource;
    assert(source.field === 'identifier');
    assert(ModelRegistryIndex.getConfig(CustomGeneratorModel).idGenerator() === 'custom-id-value');
  }

  @Test('Verify auto-discovered ModelId field')
  async testAutoDiscoveredId(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.get(AutoDiscoveredIdModel).idSource;
    assert(source.field === 'isbn');
    const generated = ModelRegistryIndex.getConfig(AutoDiscoveredIdModel).idGenerator();
    assert(typeof generated === 'string');
    assert(generated.length === 32);
  }

  @Test('Verify OptionalId and PartialWithId type behavior')
  async testOptionalIdTypes(): Promise<void> {
    const optionalItem: OptionalId<AutoDiscoveredIdModel> = { title: 'Dune' };
    assert(optionalItem.title === 'Dune');
    const optionalWithIdItem: OptionalId<AutoDiscoveredIdModel> = { isbn: '978-0441013593', title: 'Dune' };
    assert(optionalWithIdItem.isbn === '978-0441013593');

    const partialItem: PartialWithId<AutoDiscoveredIdModel> = { isbn: '978-0441013593' };
    assert(partialItem.isbn === '978-0441013593');
  }

  @Test('Verify error thrown when model has no id field')
  async testMissingIdFieldThrows(): Promise<void> {
    ModelRegistryIndex.getForRegister(InvalidMissingIdModel).register();
    assert.throws(() => Registry.finalizeForIndex(ModelRegistryIndex), /primary identifier/);
  }

  @Test('Verify error thrown when model has id: string without ModelId')
  async testPlainIdThrows(): Promise<void> {
    ModelRegistryIndex.getForRegister(PlainIdModel).register();
    assert.throws(() => Registry.finalizeForIndex(ModelRegistryIndex), /primary identifier/);
  }

  @Test('Verify schema validation with default uuid pattern and custom generator')
  async testSchemaValidation(): Promise<void> {
    await Registry.init();
    const validUuid = '0123456789abcdef0123456789abcdef';
    const validDefault = await SchemaValidator.validate(DefaultModel, { id: validUuid, name: 'Alice' });
    assert(validDefault.id === validUuid);

    // Direct validation without id rejects since id is required
    await assert.rejects(() => SchemaValidator.validate(DefaultModel, castTo({ name: 'Alice' })), ValidationResultError);

    // ModelCrudUtil generates id on preCreate
    const created = await ModelCrudUtil.preCreate(DefaultModel, castTo({ name: 'Alice' }));
    assert(created.id);

    const validCustom = await SchemaValidator.validate(CustomGeneratorModel, { identifier: 'custom-id-value', name: 'Bob' });
    assert(validCustom.identifier === 'custom-id-value');

    const validSubclass = await SchemaValidator.validate(SubclassCustomModel, {
      identifier: 'subclass-custom-id',
      name: 'Charlie',
      extra: 'detail'
    });
    assert(validSubclass.identifier === 'subclass-custom-id');
    assert(ModelRegistryIndex.getConfig(SubclassCustomModel).idGenerator() === 'custom-id-value');
  }
}
