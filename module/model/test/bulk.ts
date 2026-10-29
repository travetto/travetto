import assert from 'node:assert';

import {
  type BulkOperation,
  type BulkResponse,
  type ModelBulkSupport,
  Model,
  ModelBulkUtil,
  SubTypeNotSupportedError
} from '@travetto/model';
import { Registry } from '@travetto/registry';
import { castTo, type Class } from '@travetto/runtime';
import { DiscriminatorField, Schema, Text, ValidationResultError } from '@travetto/schema';
import { Suite, Test, TestFixtures } from '@travetto/test';

@Model()
class BulkItem {
  id: string;
  name: string;
  age?: number;
}

@Schema()
@Model()
abstract class BaseWorker {
  id: string;
  @DiscriminatorField()
  type: string;
  @Text()
  name: string;
}

@Model()
class SpecialistWorker extends BaseWorker {
  specialty: string;
}

@Suite()
export class ModelBulkUtilSuite {
  fixture = new TestFixtures();
  @Test('Verify insert generates id when omitted and populates insertedIds')
  async testInsertGeneratesId() {
    await Registry.init();
    const result = await ModelBulkUtil.preStore(BulkItem, [
      { insert: BulkItem.from({ name: 'first' }) },
      { insert: BulkItem.from({ name: 'second' }) }
    ]);

    assert(result.insertedIds.size === 2);
    assert(result.insertedIds.get(0));
    assert(result.insertedIds.get(1));
    assert(result.operations[0].insert?.id === result.insertedIds.get(0));
    assert(result.operations[1].insert?.id === result.insertedIds.get(1));
    assert(result.insertedIds.get(0) !== result.insertedIds.get(1));
  }

  @Test('Verify insert preserves explicit id')
  async testInsertPreservesId() {
    await Registry.init();
    const specificIdentifier = '0123456789abcdef0123456789abcdef';
    const result = await ModelBulkUtil.preStore(BulkItem, [{ insert: BulkItem.from({ id: specificIdentifier, name: 'explicit' }) }]);

    assert(result.insertedIds.size === 1);
    assert(result.insertedIds.get(0) === specificIdentifier);
    assert(result.operations[0].insert?.id === specificIdentifier);
  }

  @Test('Verify update requires id and rejects when omitted')
  async testUpdateRequiresId() {
    await Registry.init();
    const specificIdentifier = '0123456789abcdef0123456789abcdef';
    const validResult = await ModelBulkUtil.preStore(BulkItem, [
      { update: BulkItem.from({ id: specificIdentifier, name: 'valid-update' }) }
    ]);

    assert(validResult.updatedIds.size === 1);
    assert(validResult.updatedIds.get(0) === specificIdentifier);

    await assert.rejects(
      () => ModelBulkUtil.preStore(BulkItem, [{ update: BulkItem.from({ name: 'missing-id' }) }]),
      (error: unknown) => error instanceof ValidationResultError
    );
  }

  @Test('Verify upsert differentiates new vs existing ids')
  async testUpsertDifferentiatesNewAndExisting() {
    await Registry.init();
    const existingIdentifier = '0123456789abcdef0123456789abcdef';
    const result = await ModelBulkUtil.preStore(BulkItem, [
      { upsert: BulkItem.from({ name: 'new-item' }) },
      { upsert: BulkItem.from({ id: existingIdentifier, name: 'existing-item' }) }
    ]);

    assert(result.upsertedIds.size === 1);
    assert(result.upsertedIds.has(0));
    assert(!result.upsertedIds.has(1));

    assert(result.existingUpsertedIds.size === 1);
    assert(!result.existingUpsertedIds.has(0));
    assert(result.existingUpsertedIds.get(1) === existingIdentifier);
  }

  @Test('Verify delete requires id and populates deletedIds')
  async testDeleteRequiresId() {
    await Registry.init();
    const targetIdentifier = '0123456789abcdef0123456789abcdef';
    const result = await ModelBulkUtil.preStore(BulkItem, [{ delete: BulkItem.from({ id: targetIdentifier, name: 'to-delete' }) }]);

    assert(result.deletedIds.size === 1);
    assert(result.deletedIds.get(0) === targetIdentifier);

    await assert.rejects(
      () => ModelBulkUtil.preStore(BulkItem, [{ delete: BulkItem.from({ name: 'no-id' }) }]),
      (error: unknown) => error instanceof ValidationResultError
    );
  }

  @Test('Verify mixed operations populate all id maps by operation index')
  async testMixedOperations() {
    await Registry.init();
    const updateIdentifier = '0123456789abcdef0123456789abcdef';
    const existingUpsertIdentifier = '1123456789abcdef0123456789abcdef';
    const deleteIdentifier = '2123456789abcdef0123456789abcdef';

    const result = await ModelBulkUtil.preStore(BulkItem, [
      { insert: BulkItem.from({ name: 'inserted' }) },
      { update: BulkItem.from({ id: updateIdentifier, name: 'updated' }) },
      { upsert: BulkItem.from({ name: 'new-upsert' }) },
      { upsert: BulkItem.from({ id: existingUpsertIdentifier, name: 'existing-upsert' }) },
      { delete: BulkItem.from({ id: deleteIdentifier, name: 'deleted' }) }
    ]);

    assert(result.insertedIds.has(0));
    assert(result.updatedIds.get(1) === updateIdentifier);
    assert(result.upsertedIds.has(2));
    assert(result.existingUpsertedIds.get(3) === existingUpsertIdentifier);
    assert(result.deletedIds.get(4) === deleteIdentifier);
  }

  @Test('Verify ensureNotSubType rejects sub types across bulk operations')
  async testEnsureNotSubType() {
    await Registry.init();
    await assert.rejects(
      () =>
        ModelBulkUtil.preStore(SpecialistWorker, [{ insert: SpecialistWorker.from({ name: 'Doctor', specialty: 'Cardiology' }) }], {
          ensureNotSubType: true
        }),
      (error: unknown) => error instanceof SubTypeNotSupportedError
    );

    const validIdentifier = '0123456789abcdef0123456789abcdef';
    await assert.rejects(
      () =>
        ModelBulkUtil.preStore(
          SpecialistWorker,
          [{ delete: SpecialistWorker.from({ id: validIdentifier, name: 'Doctor', specialty: 'Cardiology' }) }],
          { ensureNotSubType: true }
        ),
      (error: unknown) => error instanceof SubTypeNotSupportedError
    );
  }

  @Test('Verify processBulk and importCSV stream and chunk bulk operations')
  async testImportCSV() {
    await Registry.init();
    const csvPath = await this.fixture.resolve('bulk-users.csv');
    const batches: BulkOperation<BulkItem>[][] = [];

    const mockService = castTo<ModelBulkSupport>({
      async processBulk(
        cls: Class<BulkItem>,
        operations: Iterable<BulkOperation<BulkItem>> | AsyncIterable<BulkOperation<BulkItem>>,
        batchSize = 500
      ): Promise<BulkResponse> {
        return ModelBulkUtil.batch(operations, batchSize, async batch => {
          batches.push(batch);
          return {
            errors: [],
            insertedIds: new Map(batch.map((operation, index) => [index, `id-${index}`])),
            counts: {
              update: 0,
              insert: 0,
              upsert: batch.length,
              delete: 0,
              error: 0
            }
          };
        });
      }
    });

    const response = await ModelBulkUtil.importCSV(mockService, BulkItem, csvPath, { batchSize: 2 });

    assert(batches.length === 2);
    assert(batches[0].length === 2);
    assert(batches[1].length === 1);
    assert(batches[0][0].upsert?.name === 'Alice');
    assert(batches[0][0].upsert?.age === 30);
    assert(batches[0][1].upsert?.name === 'Bob');
    assert(batches[0][1].upsert?.age === 25);
    assert(batches[1][0].upsert?.name === 'Charlie');
    assert(batches[1][0].upsert?.age === 40);

    assert(response.counts.upsert === 3);
    assert(response.insertedIds.size === 3);
    assert(response.insertedIds.get(0) === 'id-0');
    assert(response.insertedIds.get(1) === 'id-1');
    assert(response.insertedIds.get(2) === 'id-0');
  }

  @Test('Verify ModelBulkUtil.import accepts arbitrary object stream')
  async testImportObjects() {
    await Registry.init();
    const batches: BulkOperation<BulkItem>[][] = [];

    const mockService = castTo<ModelBulkSupport>({
      async processBulk(
        cls: Class<BulkItem>,
        operations: Iterable<BulkOperation<BulkItem>> | AsyncIterable<BulkOperation<BulkItem>>,
        batchSize = 500
      ): Promise<BulkResponse> {
        return ModelBulkUtil.batch(operations, batchSize, async batch => {
          batches.push(batch);
          return {
            errors: [],
            insertedIds: new Map(),
            counts: { update: 0, insert: 0, upsert: batch.length, delete: 0, error: 0 }
          };
        });
      }
    });

    async function* objects() {
      yield { name: 'Item 1', age: 10 };
      yield { name: 'Item 2', age: 20 };
      yield { name: 'Item 3', age: 30 };
    }

    const response = await ModelBulkUtil.import(mockService, BulkItem, objects(), { batchSize: 2 });
    assert(batches.length === 2);
    assert(batches[0].length === 2);
    assert(batches[1].length === 1);
    assert(response.counts.upsert === 3);
  }

  @Test('Verify importCSV handles polymorphic types from TSV')
  async testImportCSVPolymorphicTSV() {
    await Registry.init();
    const tsvPath = await this.fixture.resolve('bulk-workers.tsv');
    const batches: BulkOperation<BaseWorker>[][] = [];

    const mockService = castTo<ModelBulkSupport>({
      async processBulk(
        cls: Class<BaseWorker>,
        operations: Iterable<BulkOperation<BaseWorker>> | AsyncIterable<BulkOperation<BaseWorker>>,
        batchSize = 500
      ): Promise<BulkResponse> {
        return ModelBulkUtil.batch(operations, batchSize, async batch => {
          batches.push(batch);
          return {
            errors: [],
            insertedIds: new Map(),
            counts: {
              update: 0,
              insert: batch.length,
              upsert: 0,
              delete: 0,
              error: 0
            }
          };
        });
      }
    });

    const response = await ModelBulkUtil.importCSV(mockService, BaseWorker, tsvPath, { mode: 'insert' });

    assert(batches.length === 1);
    assert(batches[0].length === 2);
    assert(batches[0][0].insert instanceof SpecialistWorker);
    assert((batches[0][0].insert as SpecialistWorker).specialty === 'Cardiology');
    assert(batches[0][1].insert instanceof SpecialistWorker);
    assert((batches[0][1].insert as SpecialistWorker).specialty === 'Neurology');
    assert(response.counts.insert === 2);
  }
}
