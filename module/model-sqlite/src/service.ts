import type { DatabaseSync } from 'node:sqlite';

import { Injectable, PostConstruct } from '@travetto/di';
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

  @PostConstruct()
  async initialize(): Promise<void> {
    await super.initialize();
  }

  async upsertTable<T extends ModelType>(tableContext: TableContext<T>): Promise<void> {
    await super.upsertTable(tableContext);
    for (const sql of this.dialect.getCreateTextSearchIndexSQLs(tableContext)) {
      await this.connection.execute(sql);
    }
  }
}
