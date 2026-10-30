import { castTo, type Class, hasFunction } from '@travetto/runtime';
import { BindUtil, SchemaRegistryIndex } from '@travetto/schema';

import { ModelRegistryIndex } from '../registry/registry-index.ts';
import type { BulkOperation, BulkResponse, BulkSource, ModelBulkSupport } from '../types/bulk.ts';
import type { ModelType, OptionalId } from '../types/model.ts';
import { ModelCrudUtil } from './crud.ts';

export type BulkPreStore<T extends ModelType> = {
  insertedIds: Map<number, string>;
  upsertedIds: Map<number, string>;
  updatedIds: Map<number, string>;
  existingUpsertedIds: Map<number, string>;
  deletedIds: Map<number, string>;
  operations: BulkOperation<T>[];
};

export class ModelBulkUtil {
  /**
   * Type guard for determining if service supports bulk operation
   */
  static isSupported = hasFunction<ModelBulkSupport>('processBulk');

  static #mergeBulkResponse<E>(target: BulkResponse<E>, source: BulkResponse<E>, indexOffset: number): void {
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
   * Helper to convert an item or bulk operation into a BulkOperation
   */
  static toBulkOperation<T extends ModelType>(
    cls: Class<T>,
    operation: BulkOperation<T> | OptionalId<T> | Record<string, unknown>
  ): BulkOperation<T> {
    if (operation instanceof cls) {
      return { upsert: operation };
    }
    if ('insert' in operation || 'update' in operation || 'upsert' in operation || 'delete' in operation) {
      return operation;
    }
    const expanded = BindUtil.expandPaths(operation);
    const instance = SchemaRegistryIndex.getBaseClass(cls).from(castTo(expanded));
    return { upsert: instance };
  }

  /**
   * Helper to execute bulk operations in batches from an iterable or async iterable
   */
  static async batch<T extends ModelType, E = unknown>(
    cls: Class<T>,
    operations: BulkSource<T>,
    batchSize = 500,
    handler: (batch: BulkOperation<T>[]) => Promise<BulkResponse<E>>
  ): Promise<BulkResponse<E>> {
    if (Array.isArray(operations) && operations.length <= batchSize) {
      return handler(operations.map(operation => this.toBulkOperation(cls, operation)));
    }
    const total: BulkResponse<E> = {
      errors: [],
      insertedIds: new Map(),
      counts: { update: 0, insert: 0, upsert: 0, delete: 0, error: 0 }
    };
    let batch: BulkOperation<T>[] = [];
    let globalIndex = 0;
    for await (const operation of operations) {
      batch.push(this.toBulkOperation(cls, operation));
      if (batch.length >= batchSize) {
        const response = await handler(batch);
        this.#mergeBulkResponse(total, response, globalIndex);
        globalIndex += batch.length;
        batch = [];
      }
    }
    if (batch.length > 0) {
      const response = await handler(batch);
      this.#mergeBulkResponse(total, response, globalIndex);
    }
    return total;
  }

  /**
   * Prepares bulk operations for storage
   * @param cls
   * @param operations
   * @param options
   */
  static async preStore<T extends ModelType>(
    cls: Class<T>,
    operations: (BulkOperation<T> | OptionalId<T> | Record<string, unknown>)[],
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
    const preppedOperations: BulkOperation<T>[] = [];
    for (const rawOperation of operations) {
      const operation = this.toBulkOperation(cls, rawOperation);
      preppedOperations.push(operation);
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
    return { insertedIds, upsertedIds, updatedIds, existingUpsertedIds, deletedIds, operations: preppedOperations };
  }
}
