import type { DatabaseSync } from 'node:sqlite';

import { Injectable, PostConstruct } from '@travetto/di';
import { BaseSQLModelService } from '@travetto/model-sql';

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
  override async initialize(): Promise<void> {
    await super.initialize();
  }
}
