import { type Class, hasFunction } from '@travetto/runtime';

import type { BulkOperation, ModelBulkSupport } from '../types/bulk.ts';
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

export class ModelBulkUtil {
  /**
   * Type guard for determining if service supports bulk operation
   */
  static isSupported = hasFunction<ModelBulkSupport>('processBulk');

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

    // Pre store
    let operationIndex = 0;
    for (const operation of operations) {
      if ('insert' in operation && operation.insert) {
        operation.insert = await ModelCrudUtil.preCreate(cls, operation.insert, options);
        insertedIds.set(operationIndex, operation.insert.id!);
      } else if ('update' in operation && operation.update) {
        operation.update = await ModelCrudUtil.preUpdate(cls, operation.update, options);
        updatedIds.set(operationIndex, operation.update.id);
      } else if ('upsert' in operation && operation.upsert) {
        const isNew = !operation.upsert.id;
        operation.upsert = await ModelCrudUtil.preUpsert(cls, operation.upsert, options);
        if (isNew) {
          upsertedIds.set(operationIndex, operation.upsert.id!);
        } else {
          existingUpsertedIds.set(operationIndex, operation.upsert.id!);
        }
      } else if ('delete' in operation && operation.delete) {
        await ModelCrudUtil.preDelete(cls, operation.delete.id, options);
        deletedIds.set(operationIndex, operation.delete.id);
      }
      operationIndex += 1;
    }
    return { insertedIds, upsertedIds, updatedIds, existingUpsertedIds, deletedIds, operations };
  }
}
