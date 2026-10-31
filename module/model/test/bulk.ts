import assert from 'node:assert';

import {
  type BatchResult,
  type BulkConfig,
  type BulkOperation,
  type BulkResponse,
  type BulkSource,
  type ModelBulkSupport,
  type ModelCrudSupport,
  type ModelType,
  type OptionalId,
  BulkProcessError,
  ExistsError,
  Model,
  ModelBulkUtil,
  NotFoundError,
  SubTypeNotSupportedError
} from '@travetto/model';
import { Registry } from '@travetto/registry';
import { castTo, type Class } from '@travetto/runtime';
import { DiscriminatorField, Schema, Text, ValidationResultError } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

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

  @Test('Verify processBulk with object stream and batches')
  async testProcessBulkStream() {
    await Registry.init();
    const batches: BulkOperation<BulkItem>[][] = [];

    const mockService = castTo<ModelBulkSupport>({
      async processBulk(cls: Class<BulkItem>, operations: BulkSource<BulkItem>, config: number | BulkConfig = 500): Promise<BulkResponse> {
        return ModelBulkUtil.batch(operations, config, async batch => {
          const normalized = batch.map(item => ModelBulkUtil.toBulkOperation(cls, item));
          batches.push(normalized);
          return {
            errors: [],
            insertedIds: new Map(normalized.map((operation, index) => [index, `id-${index}`])),
            counts: {
              update: 0,
              insert: 0,
              upsert: normalized.length,
              delete: 0,
              error: 0
            }
          };
        });
      }
    });

    async function* objects() {
      yield { name: 'Alice', age: 30 };
      yield { name: 'Bob', age: 25 };
      yield { name: 'Charlie', age: 40 };
    }

    const response = await mockService.processBulk(BulkItem, objects(), 2);

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

  @Test('Verify processBulk handles polymorphic types')
  async testProcessBulkPolymorphic() {
    await Registry.init();
    const batches: BulkOperation<BaseWorker>[][] = [];

    const mockService = castTo<ModelBulkSupport>({
      async processBulk(cls: Class<BaseWorker>, operations: BulkSource<BaseWorker>, config: number | BulkConfig = 500): Promise<BulkResponse> {
        return ModelBulkUtil.batch(operations, config, async batch => {
          const normalized = batch.map(item => ModelBulkUtil.toBulkOperation(cls, item));
          batches.push(normalized);
          return {
            errors: [],
            insertedIds: new Map(),
            counts: {
              update: 0,
              insert: 0,
              upsert: normalized.length,
              delete: 0,
              error: 0
            }
          };
        });
      }
    });

    async function* workers() {
      yield { type: 'specialist_worker', name: 'Dr. Smith', specialty: 'Cardiology' };
      yield { type: 'specialist_worker', name: 'Dr. Jones', specialty: 'Neurology' };
    }

    const response = await mockService.processBulk(BaseWorker, workers());

    assert(batches.length === 1);
    assert(batches[0].length === 2);
    assert(batches[0][0].upsert instanceof SpecialistWorker);
    assert((batches[0][0].upsert as SpecialistWorker).specialty === 'Cardiology');
    assert(batches[0][1].upsert instanceof SpecialistWorker);
    assert((batches[0][1].upsert as SpecialistWorker).specialty === 'Neurology');
    assert(response.counts.upsert === 2);
  }

  @Test('Verify raw items are treated as upserts')
  async testTreatItemsAsUpsert() {
    await Registry.init();
    const batches: BulkOperation<BulkItem>[][] = [];

    const mockService = castTo<ModelBulkSupport>({
      async processBulk(cls: Class<BulkItem>, operations: BulkSource<BulkItem>, config: number | BulkConfig = 500): Promise<BulkResponse> {
        return ModelBulkUtil.batch(operations, config, async batch => {
          const normalized = batch.map(item => ModelBulkUtil.toBulkOperation(cls, item));
          batches.push(normalized);
          return {
            errors: [],
            insertedIds: new Map(),
            counts: { update: 0, insert: 0, upsert: normalized.length, delete: 0, error: 0 }
          };
        });
      }
    });

    const items = [
      BulkItem.from({ name: 'Alpha', age: 10 }),
      BulkItem.from({ name: 'Beta', age: 20 }),
      BulkItem.from({ name: 'Gamma', age: 30 })
    ];

    const response = await mockService.processBulk(BulkItem, items, 2);
    assert(batches.length === 2);
    assert(batches[0][0].upsert?.name === 'Alpha');
    assert(batches[0][1].upsert?.name === 'Beta');
    assert(batches[1][0].upsert?.name === 'Gamma');
    assert(response.counts.upsert === 3);

    // Also verify preStore directly with raw items
    const prepped = await ModelBulkUtil.preStore(BulkItem, items);
    assert(prepped.operations.length === 3);
    assert(prepped.operations[0].upsert?.name === 'Alpha');
    assert(prepped.operations[1].upsert?.name === 'Beta');
    assert(prepped.operations[2].upsert?.name === 'Gamma');
  }

  @Test('Verify error indices are offset across batches in BulkResponse')
  async testBulkResponseErrorIndexOffset() {
    await Registry.init();
    type CustomBulkError = { index?: number; idx?: number; message: string };

    const items = [
      BulkItem.from({ name: 'First' }),
      BulkItem.from({ name: 'Second' }),
      BulkItem.from({ name: 'Third' }),
      BulkItem.from({ name: 'Fourth' })
    ];

    let batchCount = 0;
    const response = await ModelBulkUtil.batch<BulkItem, CustomBulkError>(items, 2, async () => {
      batchCount += 1;
      if (batchCount === 1) {
        return {
          errors: [{ index: 1, message: 'First batch error' }],
          insertedIds: new Map(),
          counts: { update: 0, insert: 0, upsert: 1, delete: 0, error: 1 }
        };
      } else {
        return {
          errors: [
            { index: 0, message: 'Second batch error index' },
            { idx: 1, message: 'Second batch error idx' }
          ],
          insertedIds: new Map(),
          counts: { update: 0, insert: 0, upsert: 0, delete: 0, error: 2 }
        };
      }
    });

    assert.strictEqual(response.errors.length, 3);
    assert.strictEqual(response.errors[0].index, 1);
    assert.strictEqual(response.errors[1].index, 2);
    assert.strictEqual(response.errors[2].idx, 3);
  }

  @Test('Verify thrown BulkProcessError indices are offset across batches')
  async testBulkProcessErrorIndexOffset() {
    await Registry.init();

    const items = [
      BulkItem.from({ name: 'First' }),
      BulkItem.from({ name: 'Second' }),
      BulkItem.from({ name: 'Third' }),
      BulkItem.from({ name: 'Fourth' })
    ];

    let batchCount = 0;
    await assert.rejects(
      () =>
        ModelBulkUtil.batch<BulkItem>(items, 2, async () => {
          batchCount += 1;
          if (batchCount === 1) {
            return {
              errors: [],
              insertedIds: new Map(),
              counts: { update: 0, insert: 0, upsert: 2, delete: 0, error: 0 }
            };
          } else {
            const validationError = new ValidationResultError([
              { kind: 'required', path: 'name', type: 'string', message: 'name is required' }
            ]);
            throw new BulkProcessError([{ idx: 1, error: validationError }]);
          }
        }),
      (error: unknown) => {
        assert(error instanceof BulkProcessError);
        assert.strictEqual(error.details?.errors?.length, 1);
        assert.strictEqual(error.details?.errors?.[0]?.idx, 3);
        return true;
      }
    );
  }

  @Test('Verify processCrud delegates to ModelCrudSupport and catches errors')
  async testProcessCrud() {
    await Registry.init();

    const storage = new Map<string, BulkItem>();
    const mockService: ModelCrudSupport = {
      client: 'mock',
      async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
        const entity = item as unknown as BulkItem;
        entity.id ??= `gen-${Math.random()}`;
        if (storage.has(entity.id)) {
          throw new ExistsError(cls as Class, entity.id);
        }
        storage.set(entity.id, entity);
        return castTo<T>(entity);
      },
      async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
        const entity = item as unknown as BulkItem;
        if (!storage.has(entity.id)) {
          throw new NotFoundError(cls as Class, entity.id);
        }
        storage.set(entity.id, entity);
        return castTo<T>(entity);
      },
      async upsert<T extends ModelType>(_cls: Class<T>, item: OptionalId<T>): Promise<T> {
        const entity = item as unknown as BulkItem;
        entity.id ??= `gen-${Math.random()}`;
        storage.set(entity.id, entity);
        return castTo<T>(entity);
      },
      async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
        if (!storage.has(id)) {
          throw new NotFoundError(cls as Class, id);
        }
        storage.delete(id);
      },
      async get<T>(cls: Class<T>, id: string): Promise<T> {
        const found = storage.get(id);
        if (!found) {
          throw new NotFoundError(cls as Class, id);
        }
        return found as unknown as T;
      },
      list: undefined as unknown as ModelCrudSupport['list'],
      updatePartial: undefined as unknown as ModelCrudSupport['updatePartial']
    };

    // Prepopulate 1 item
    storage.set('existing-1', BulkItem.from({ id: 'existing-1', name: 'Existing' }));

    const response = await ModelBulkUtil.processCrud(mockService, BulkItem, [
      { insert: BulkItem.from({ name: 'Inserted' }) },
      { update: BulkItem.from({ id: 'existing-1', name: 'Updated' }) },
      { update: BulkItem.from({ id: 'missing-id', name: 'Missing' }) },
      { upsert: BulkItem.from({ id: 'new-upsert', name: 'Upserted' }) },
      { delete: BulkItem.from({ id: 'existing-1' }) },
      { delete: BulkItem.from({ id: 'missing-delete' }) }
    ]);

    assert.strictEqual(response.counts.insert, 1);
    assert.strictEqual(response.counts.update, 1);
    assert.strictEqual(response.counts.upsert, 1);
    assert.strictEqual(response.counts.delete, 1);
    assert.strictEqual(response.counts.error, 2);
    assert.strictEqual(response.errors.length, 2);
    assert.strictEqual((response.errors[0] as { index: number }).index, 2);
    assert.strictEqual((response.errors[1] as { index: number }).index, 5);
    assert.strictEqual(response.insertedIds.size, 1);
  }

  @Test('Verify processRaw handles preStore and merges response')
  async testProcessRaw() {
    await Registry.init();

    const response = await ModelBulkUtil.processRaw(
      BulkItem,
      [{ insert: BulkItem.from({ name: 'Raw Insert' }) }, { upsert: BulkItem.from({ name: 'Raw Upsert' }) }],
      10,
      async prepped => {
        assert.strictEqual(prepped.operations.length, 2);
        assert(prepped.insertedIds.has(0));
        assert(prepped.upsertedIds.has(1));
        return {
          counts: { insert: 1, update: 0, upsert: 1, delete: 0, error: 0 },
          errors: [],
          insertedIds: new Map([
            [0, 'raw-insert'],
            [1, 'raw-upsert']
          ])
        };
      }
    );

    assert.strictEqual(response.counts.insert, 1);
    assert.strictEqual(response.counts.upsert, 1);
    assert.strictEqual(response.insertedIds.size, 2);
  }

  @Test('Verify processBulk onBatch callback with batches and streams')
  async testProcessBulkOnBatchCallback() {
    await Registry.init();
    const emittedBatchResults: BatchResult[] = [];

    const mockService = castTo<ModelBulkSupport>({
      async processBulk(cls: Class<BulkItem>, operations: BulkSource<BulkItem>, config: number | BulkConfig = 500): Promise<BulkResponse> {
        return ModelBulkUtil.batch(operations, config, async batch => {
          const normalized = batch.map(item => ModelBulkUtil.toBulkOperation(cls, item));
          return {
            errors: [],
            insertedIds: new Map(normalized.map((operation, index) => [index, `batch-id-${index}`])),
            counts: {
              update: 0,
              insert: 0,
              upsert: normalized.length,
              delete: 0,
              error: 0
            }
          };
        });
      }
    });

    async function* objects() {
      yield { name: 'Alice', age: 30 };
      yield { name: 'Bob', age: 25 };
      yield { name: 'Charlie', age: 40 };
      yield { name: 'Dave', age: 35 };
      yield { name: 'Eve', age: 28 };
    }

    const response = await mockService.processBulk(BulkItem, objects(), {
      batchSize: 2,
      onBatch: async (result: BatchResult) => {
        emittedBatchResults.push(result);
      }
    });

    assert.strictEqual(emittedBatchResults.length, 3);
    assert.strictEqual(emittedBatchResults[0].counts.upsert, 2);
    assert.strictEqual(emittedBatchResults[1].counts.upsert, 2);
    assert.strictEqual(emittedBatchResults[2].counts.upsert, 1);
    assert.strictEqual(response.counts.upsert, 5);
  }

  @Test('Verify processBulk onBatch callback with array within single batch')
  async testProcessBulkOnBatchSingleBatch() {
    await Registry.init();
    const emittedBatchResults: BatchResult[] = [];

    const mockService = castTo<ModelBulkSupport>({
      async processBulk(cls: Class<BulkItem>, operations: BulkSource<BulkItem>, config: number | BulkConfig = 500): Promise<BulkResponse> {
        return ModelBulkUtil.batch(operations, config, async batch => {
          const normalized = batch.map(item => ModelBulkUtil.toBulkOperation(cls, item));
          return {
            errors: [],
            insertedIds: new Map(normalized.map((operation, index) => [index, `single-id-${index}`])),
            counts: {
              update: 0,
              insert: normalized.length,
              upsert: 0,
              delete: 0,
              error: 0
            }
          };
        });
      }
    });

    const items = [
      BulkItem.from({ name: 'First' }),
      BulkItem.from({ name: 'Second' })
    ];

    const response = await mockService.processBulk(BulkItem, items, {
      batchSize: 10,
      onBatch: (result: BatchResult) => {
        emittedBatchResults.push(result);
      }
    });

    assert.strictEqual(emittedBatchResults.length, 1);
    assert.strictEqual(emittedBatchResults[0].counts.insert, 2);
    assert.strictEqual(response.counts.insert, 2);
  }
}
