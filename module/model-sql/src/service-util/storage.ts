import { ModelRegistryIndex } from '@travetto/model';
import type { Class } from '@travetto/runtime';

import type { SQLDialect } from '../dialect.ts';

export class SQLModelStorageUtil {
  static async createStorage(dialect: SQLDialect): Promise<void> {
    for (const modelClass of ModelRegistryIndex.getClasses()) {
      await dialect.upsertTable(modelClass);
    }
  }

  static async deleteStorage(dialect: SQLDialect): Promise<void> {
    for (const modelClass of ModelRegistryIndex.getClasses()) {
      await dialect.dropTable(modelClass);
    }
  }

  static async deleteModel(dialect: SQLDialect, modelClass: Class): Promise<void> {
    await dialect.dropTable(modelClass);
  }

  static async upsertModel(dialect: SQLDialect, modelClass: Class): Promise<void> {
    await dialect.upsertTable(modelClass);
  }
}
