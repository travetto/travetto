import { type Class, hasFunction } from '@travetto/runtime';

import type { BulkOperation, ModelBulkSupport } from '../types/bulk.ts';
import type { ModelType } from '../types/model.ts';
import { ModelCrudUtil } from './crud.ts';

export type BulkPreStore<T extends ModelType> = {
  insertedIds: Map<number, string>;
  upsertedIds: Map<number, string>;
  updatedIds: Map<number, string>;
  existingUpsertedIds: Map<number, string>;
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
   */
  static async preStore<T extends ModelType>(cls: Class<T>, operations: BulkOperation<T>[]): Promise<BulkPreStore<T>> {
    const insertedIds = new Map<number, string>();
    const upsertedIds = new Map<number, string>();
    const updatedIds = new Map<number, string>();
    const existingUpsertedIds = new Map<number, string>();

    // Pre store
    let i = 0;
    for (const operation of operations) {
      if ('insert' in operation && operation.insert) {
        operation.insert = await ModelCrudUtil.preStore(cls, operation.insert);
        insertedIds.set(i, operation.insert.id!);
      } else if ('update' in operation && operation.update) {
        operation.update = await ModelCrudUtil.preStore(cls, operation.update);
        updatedIds.set(i, operation.update.id);
      } else if ('upsert' in operation && operation.upsert) {
        const isNew = !operation.upsert.id;
        operation.upsert = await ModelCrudUtil.preStore(cls, operation.upsert);
        if (isNew) {
          upsertedIds.set(i, operation.upsert.id!);
        } else {
          existingUpsertedIds.set(i, operation.upsert.id!);
        }
      }
      i += 1;
    }
    return { insertedIds, upsertedIds, updatedIds, existingUpsertedIds, operations };
  }
}
