import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { Suite, Test } from '@travetto/test';

import { ExistsError } from '../src/error/exists.ts';
import { NotFoundError } from '../src/error/not-found.ts';
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
class CustomGeneratorModel {
  @IdGenerator((): string => 'custom-id-value')
  identifier: ModelId;
  name: string;
}

@Model()
class NaturalKeyModel {
  @IdGenerator(false)
  isbn: ModelId;
  title: string;
}

@Model()
class AutoDiscoveredIdModel {
  isbn: ModelId;
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
    assert(source.create() === 'custom-id-value');
  }

  @Test('Verify natural key')
  async testNaturalKey(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.getIdSource(NaturalKeyModel);
    assert(source.field === 'isbn');
    assert(source.generator === undefined);
  }

  @Test('Verify getNotFoundError')
  async testNotFoundError(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.getIdSource(DefaultModel);

    const errorFromItem = source.getNotFoundError({ id: 'missing-123', name: 'Item' });
    assert(errorFromItem instanceof NotFoundError);
    assert(errorFromItem.message.includes('missing-123'));
    assert(errorFromItem.message.includes('DefaultModel'));

    const errorFromId = source.getNotFoundError('missing-456');
    assert(errorFromId instanceof NotFoundError);
    assert(errorFromId.message.includes('missing-456'));

    const errorFromEmpty = source.getNotFoundError({});
    assert(errorFromEmpty instanceof NotFoundError);
    assert(errorFromEmpty.message.includes('unknown'));
  }

  @Test('Verify getExistsError')
  async testExistsError(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.getIdSource(DefaultModel);

    const errorFromItem = source.getExistsError({ id: 'existing-123', name: 'Item' });
    assert(errorFromItem instanceof ExistsError);
    assert(errorFromItem.message.includes('existing-123'));
    assert(errorFromItem.message.includes('DefaultModel'));

    const errorFromId = source.getExistsError('existing-456');
    assert(errorFromId instanceof ExistsError);
    assert(errorFromId.message.includes('existing-456'));

    const errorFromEmpty = source.getExistsError({});
    assert(errorFromEmpty instanceof ExistsError);
    assert(errorFromEmpty.message.includes('unknown'));
  }

  @Test('Verify auto-discovered ModelId field')
  async testAutoDiscoveredId(): Promise<void> {
    await Registry.init();
    const source = ModelRegistryIndex.getIdSource(AutoDiscoveredIdModel);
    assert(source.field === 'isbn');
    assert(source.generator !== undefined);
    const generated = source.create();
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
}
