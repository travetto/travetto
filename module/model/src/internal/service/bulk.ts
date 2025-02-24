import { Class } from '@travetto/runtime';

import { BulkOp } from '../../service/bulk.ts';
import { ModelType } from '../../types/model.ts';
import { ModelCrudProvider, ModelCrudUtil } from './crud.ts';

export type BulkPreStore<T extends ModelType> = {
  insertedIds: Map<number, string>;
  upsertedIds: Map<number, string>;
  updatedIds: Map<number, string>;
  existingUpsertedIds: Map<number, string>;
  operations: BulkOp<T>[];
};

export class ModelBulkUtil {
  /**
   * Prepares bulk ops for storage
   * @param cls
   * @param operations
   * @param provider
   */
  static async preStore<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[], provider: ModelCrudProvider): Promise<BulkPreStore<T>> {
    const insertedIds = new Map<number, string>();
    const upsertedIds = new Map<number, string>();
    const updatedIds = new Map<number, string>();
    const existingUpsertedIds = new Map<number, string>();

    // Pre store
    let i = 0;
    for (const op of operations) {
      if ('insert' in op && op.insert) {
        op.insert = await ModelCrudUtil.preStore(cls, op.insert, provider);
        insertedIds.set(i, op.insert.id!);
      } else if ('update' in op && op.update) {
        op.update = await ModelCrudUtil.preStore(cls, op.update, provider);
        updatedIds.set(i, op.update.id);
      } else if ('upsert' in op && op.upsert) {
        const isNew = !op.upsert.id;
        op.upsert = await ModelCrudUtil.preStore(cls, op.upsert, provider);
        if (isNew) {
          upsertedIds.set(i, op.upsert.id!);
        } else {
          existingUpsertedIds.set(i, op.upsert.id!);
        }
      }
      i += 1;
    }
    return { insertedIds, upsertedIds, updatedIds, existingUpsertedIds, operations };
  }
}