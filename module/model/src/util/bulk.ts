import { castTo, type Class, hasFunction, JSONUtil } from '@travetto/runtime';
import { BindUtil, SchemaRegistryIndex } from '@travetto/schema';

import { ModelRegistryIndex } from '../registry/registry-index.ts';
import type { BulkOperation, BulkResponse, ModelBulkSupport } from '../types/bulk.ts';
import type { ModelType } from '../types/model.ts';
import { ModelCrudUtil } from './crud.ts';

export type BulkPreStore<T extends ModelType> = {
  insertedIds: Map<number, string>;
  upsertedIds: Map<number, string>;
  updatedIds: Map<number, string>;
  existingUpsertedIds: Map<number, string>;
  deletedIds: Map<number, string>;
  operations: BulkOperation<T>[];
};

export type BulkImportOptions = {
  batchSize?: number;
  separator?: string;
  mode?: 'insert' | 'upsert';
};

export class ModelBulkUtil {
  /**
   * Type guard for determining if service supports bulk operation
   */
  static isSupported = hasFunction<ModelBulkSupport>('processBulk');

  static #mergeBulkResponse(target: BulkResponse, source: BulkResponse, indexOffset: number): void {
    target.errors.push(...source.errors);
    for (const [key, value] of source.insertedIds.entries()) {
      target.insertedIds.set(key + indexOffset, value);
    }
    target.counts.update += source.counts.update;
    target.counts.insert += source.counts.insert;
    target.counts.upsert += source.counts.upsert;
    target.counts.delete += source.counts.delete;
    target.counts.error += source.counts.error;
  }

  /**
   * Prepares bulk operations for storage
   * @param cls
   * @param operations
   * @param options
   */
  static async preStore<T extends ModelType>(
    cls: Class<T>,
    operations: BulkOperation<T>[],
    options?: { ensureNotSubType?: boolean }
  ): Promise<BulkPreStore<T>> {
    const insertedIds = new Map<number, string>();
    const upsertedIds = new Map<number, string>();
    const updatedIds = new Map<number, string>();
    const existingUpsertedIds = new Map<number, string>();
    const deletedIds = new Map<number, string>();

    const idSource = ModelRegistryIndex.get(cls).idSource;

    // Pre store
    let operationIndex = 0;
    for (const operation of operations) {
      if ('insert' in operation && operation.insert) {
        operation.insert = await ModelCrudUtil.preCreate(cls, operation.insert, options);
        insertedIds.set(operationIndex, idSource.get(operation.insert));
      } else if ('update' in operation && operation.update) {
        operation.update = await ModelCrudUtil.preUpdate(cls, operation.update, options);
        updatedIds.set(operationIndex, idSource.get(operation.update));
      } else if ('upsert' in operation && operation.upsert) {
        const isNew = !idSource.get(operation.upsert, { optional: true });
        operation.upsert = await ModelCrudUtil.preUpsert(cls, operation.upsert, options);
        if (isNew) {
          upsertedIds.set(operationIndex, idSource.get(operation.upsert));
        } else {
          existingUpsertedIds.set(operationIndex, idSource.get(operation.upsert));
        }
      } else if ('delete' in operation && operation.delete) {
        const id = idSource.get(operation.delete);
        await ModelCrudUtil.preDelete(cls, id, options);
        deletedIds.set(operationIndex, id);
      }
      operationIndex += 1;
    }
    return { insertedIds, upsertedIds, updatedIds, existingUpsertedIds, deletedIds, operations };
  }

  /**
   * Import a CSV/TSV into a model via bulk operations
   * @param service The model bulk service to target
   * @param cls The model class to populate
   * @param location File path of the CSV/TSV
   * @param options Import options including batch size, separator, and operation mode
   */
  static async importCSV<T extends ModelType>(
    service: ModelBulkSupport,
    cls: Class<T>,
    location: string,
    options?: BulkImportOptions
  ): Promise<BulkResponse> {
    const batchSize = options?.batchSize ?? 500;
    const mode = options?.mode ?? 'upsert';
    const total: BulkResponse = {
      errors: [],
      insertedIds: new Map(),
      counts: {
        update: 0,
        insert: 0,
        upsert: 0,
        delete: 0,
        error: 0
      }
    };

    let batch: BulkOperation<T>[] = [];
    let globalIndex = 0;

    for await (const row of JSONUtil.fromCSV<Record<string, unknown>>(location, options?.separator)) {
      const expanded = BindUtil.expandPaths(row);
      const instance = SchemaRegistryIndex.getBaseClass(cls).from(castTo(expanded));
      batch.push({ [mode]: instance });

      if (batch.length >= batchSize) {
        const response = await service.processBulk(cls, batch);
        this.#mergeBulkResponse(total, response, globalIndex);
        globalIndex += batch.length;
        batch = [];
      }
    }

    if (batch.length > 0) {
      const response = await service.processBulk(cls, batch);
      this.#mergeBulkResponse(total, response, globalIndex);
    }

    return total;
  }
}
