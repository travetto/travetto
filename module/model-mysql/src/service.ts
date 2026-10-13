import type { PoolConnection } from 'mysql2/promise';

import { Injectable } from '@travetto/di';
import type { ModelType } from '@travetto/model';
import { BaseSQLModelService, type TableContext } from '@travetto/model-sql';
import { Env } from '@travetto/runtime';

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

  async truncateTable<T extends ModelType>(tableContext: TableContext<T>): Promise<void> {
    if (Env.TRV_ROLE.value === 'test') {
      await this.deleteByQuery(tableContext.cls, {});
    } else {
      await super.truncateTable(tableContext);
    }
  }
}
