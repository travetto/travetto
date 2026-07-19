import { InjectableFactory } from '@travetto/di';
import { type PostgresJsonConnection, PostgresJsonModelService } from '@travetto/model-postgres-json';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelService(connection: PostgresJsonConnection) {
    return new PostgresJsonModelService(connection);
  }
}
