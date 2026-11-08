import type { DatabaseSync } from 'node:sqlite';

import { Injectable } from '@travetto/di';
import type { ModelType } from '@travetto/model';
import { BaseSQLModelService, type TableContext } from '@travetto/model-sql';

import type { SqliteConnection } from './connection.ts';

/**
 * A SQLite JSON-based document store model service
 */
@Injectable()
export class SqliteModelService extends BaseSQLModelService {
  connection: SqliteConnection;

  constructor(connection: SqliteConnection) {
    super();
    this.connection = connection;
  }

  get client(): DatabaseSync {
    return this.connection.active!;
  }

  async upsertTable<T extends ModelType>(tableContext: TableContext<T>): Promise<void> {
    await super.upsertTable(tableContext);
    const textFields = this.dialect.getTextSearchFields(tableContext);
    if (textFields.length > 0) {
      const ftsContext: TableContext<T> = { ...tableContext, tableName: `${tableContext.tableName}_fts` };
      if (!(await this.doesTableExist(ftsContext))) {
        for (const statement of this.dialect.getCreateTextSearchIndexSQLs(tableContext)) {
          await this.connection.execute(statement);
        }
      }
    }
  }
}
