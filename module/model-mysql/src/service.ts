import type { PoolConnection } from 'mysql2/promise';

import { Injectable, PostConstruct } from '@travetto/di';
import type { ModelCrudSupport } from '@travetto/model';
import { BaseSQLModelService } from '@travetto/model-sql';

import type { MysqlConnection } from './connection.ts';

/**
 * A MySQL JSON-based document store model service
 */
@Injectable()
export class MysqlModelService extends BaseSQLModelService {
  connection: MysqlConnection;

  constructor(connection: MysqlConnection) {
    super();
    this.connection = connection;
  }

  get client(): PoolConnection {
    return this.connection.active!;
  }

  @PostConstruct()
  override async initialize(): Promise<void> {
    await super.initialize();
  }
}
