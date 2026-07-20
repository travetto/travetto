import { InjectableFactory } from '@travetto/di';
import { SqliteConnection, SqliteModelService } from '@travetto/model-sqlite';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelService(connection: SqliteConnection) {
    return new SqliteModelService(connection);
  }
}
