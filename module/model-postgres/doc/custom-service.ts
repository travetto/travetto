import { InjectableFactory } from '@travetto/di';
import { type PostgresConnection, PostgresModelService } from '@travetto/model-postgres';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelService(connection: PostgresConnection) {
    return new PostgresModelService(connection);
  }
}
