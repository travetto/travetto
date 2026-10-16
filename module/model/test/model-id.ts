import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { castTo } from '@travetto/runtime';
import { Schema, SchemaValidator, ValidationResultError } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

import { IdGenerator, Model } from '../src/registry/decorator.ts';
import { ModelRegistryIndex } from '../src/registry/registry-index.ts';
import type { ModelId, OptionalId, PartialWithId } from '../src/types/model.ts';
import { CustomIdModel } from '../support/test/crud.ts';

@Model()
class DefaultModel {
  id: ModelId;
  name: string;
}

@Model()
@IdGenerator((): string => 'custom-id-value')
class CustomGeneratorModel {
  identifier: ModelId;
  name: string;
}

@Model()
class SubclassCustomModel extends CustomGeneratorModel {
  extra: string;
}

@Model()
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
    const source = ModelRegistryIndex.getIdSource(DefaultModel);
    assert(source.field === 'id');

    const generatedId = ModelRegistryIndex.createId(DefaultModel);
    assert(typeof generatedId === 'string');
    assert(generatedId.length === 32);

    const item: DefaultModel = { id: 'test-123', name: 'Sample' };
    assert(source.getValue(item) === 'test-123');
    assert(source.getOptionalValue(item) === 'test-123');

    const emptyItem: OptionalId<DefaultModel> = { name: 'No Id' };
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
    assert(source.field === 'customId');

    const item: CustomIdModel = { customId: 'code-1', name: 'Item' };
    assert(source.getValue(item) === 'code-1');

    const whereClause = source.getWhereClause('code-99');
    assert.deepStrictEqual(whereClause, { customId: 'code-99' });
  }

  @Test('Verify custom generator')
  async testCustomGenerator(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.getIdSource(CustomGeneratorModel);
    assert(source.field === 'identifier');
    assert(ModelRegistryIndex.createId(CustomGeneratorModel) === 'custom-id-value');
  }

  @Test('Verify auto-discovered ModelId field')
  async testAutoDiscoveredId(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.getIdSource(AutoDiscoveredIdModel);
    assert(source.field === 'isbn');
    const generated = ModelRegistryIndex.createId(AutoDiscoveredIdModel);
    assert(typeof generated === 'string');
    assert(generated.length === 32);
  }

  @Test('Verify OptionalId and PartialWithId type behavior')
  async testOptionalIdTypes(): Promise<void> {
    const opt: OptionalId<AutoDiscoveredIdModel> = { title: 'Dune' };
    assert(opt.title === 'Dune');
    const optWithId: OptionalId<AutoDiscoveredIdModel> = { isbn: '978-0441013593', title: 'Dune' };
    assert(optWithId.isbn === '978-0441013593');

    const part: PartialWithId<AutoDiscoveredIdModel> = { isbn: '978-0441013593' };
    assert(part.isbn === '978-0441013593');
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

    const validDefaultWithoutId = await SchemaValidator.validate(DefaultModel, castTo({ name: 'Alice' }));
    assert(validDefaultWithoutId.id === undefined);

    await assert.rejects(() => SchemaValidator.validate(DefaultModel, { id: 'invalid-uuid-format', name: 'Alice' }), ValidationResultError);

    const validCustom = await SchemaValidator.validate(CustomGeneratorModel, { identifier: 'custom-id-value', name: 'Bob' });
    assert(validCustom.identifier === 'custom-id-value');

    const validSubclass = await SchemaValidator.validate(SubclassCustomModel, {
      identifier: 'subclass-custom-id',
      name: 'Charlie',
      extra: 'detail'
    });
    assert(validSubclass.identifier === 'subclass-custom-id');
    assert(ModelRegistryIndex.createId(SubclassCustomModel) === 'custom-id-value');
  }
}
