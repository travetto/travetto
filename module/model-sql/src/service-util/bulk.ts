import { type BulkOperation, type BulkResponse, ModelBulkUtil, type ModelCrudProvider, type ModelType } from '@travetto/model';
import type { Class } from '@travetto/runtime';
import { WorkPool } from '@travetto/worker';

import type { SQLConnection } from '../connection.ts';
import type { SQLDialect } from '../dialect.ts';
import { SQLModelCrudUtil } from './crud.ts';

export class SQLModelBulkUtil {
  static async processBulk<T extends ModelType>(
    conn: SQLConnection,
    dialect: SQLDialect,
    modelClass: Class<T>,
    operations: BulkOperation<T>[],
    modelSource: ModelCrudProvider
  ): Promise<BulkResponse> {
    const { insertedIds, upsertedIds, operations: preppedOps } = await ModelBulkUtil.preStore(modelClass, operations, modelSource);

    const addedIds = new Map([...insertedIds.entries(), ...upsertedIds.entries()]);

    const counts = {
      update: 0,
      insert: 0,
      upsert: 0,
      delete: 0,
      error: 0
    };
    const errors: unknown[] = [];

    await WorkPool.run(
      async op => {
        try {
          if ('insert' in op && op.insert) {
            await SQLModelCrudUtil.create(conn, dialect, modelClass, op.insert, modelSource);
            counts.insert++;
          } else if ('update' in op && op.update) {
            await SQLModelCrudUtil.update(conn, dialect, modelClass, op.update, modelSource);
            counts.update++;
          } else if ('upsert' in op && op.upsert) {
            await SQLModelCrudUtil.upsert(conn, dialect, modelClass, op.upsert, modelSource);
            counts.upsert++;
          } else if ('delete' in op && op.delete) {
            await SQLModelCrudUtil.delete(conn, dialect, modelClass, op.delete.id);
            counts.delete++;
          }
        } catch (err) {
          counts.error++;
          errors.push(err);
        }
      },
      preppedOps,
      { max: 8 }
    );

    return {
      errors,
      insertedIds: addedIds,
      counts
    };
  }
}
