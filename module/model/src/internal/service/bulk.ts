import { Class } from '@travetto/base';

import { BulkOp } from '../../service/bulk';
import { ModelType } from '../../types/model';
import { ModelCrudUtil } from './crud';

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
   * @param idSource
   */
  static async preStore<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[], idSource: { uuid(): string }): Promise<BulkPreStore<T>> {
    const insertedIds = new Map<number, string>();
    const upsertedIds = new Map<number, string>();
    const updatedIds = new Map<number, string>();
    const existingUpsertedIds = new Map<number, string>();

    // Pre store
    let i = 0;
    for (const op of operations) {
      if ('insert' in op && op.insert) {
        op.insert = await ModelCrudUtil.preStore(cls, op.insert, idSource);
        insertedIds.set(i, op.insert.id!);
      } else if ('update' in op && op.update) {
        op.update = await ModelCrudUtil.preStore(cls, op.update, idSource);
        updatedIds.set(i, op.update.id);
      } else if ('upsert' in op && op.upsert) {
        const isNew = !op.upsert.id;
        op.upsert = await ModelCrudUtil.preStore(cls, op.upsert, idSource);
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