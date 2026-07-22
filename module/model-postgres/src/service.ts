import type { default as pg } from 'pg';

import { Injectable, PostConstruct } from '@travetto/di';
import { BaseSQLModelService } from '@travetto/model-sql';

import type { PostgresConnection } from './connection.ts';

/**
 * A PostgreSQL JSON-based document store model service
 */
@Injectable()
export class PostgresModelService extends BaseSQLModelService {
  connection: PostgresConnection;

  constructor(connection: PostgresConnection) {
    super();
    this.connection = connection;
  }

  get client(): pg.Pool {
    return this.connection.pool;
  }

  @PostConstruct()
  override async initialize(): Promise<void> {
    await super.initialize();
  }
}
