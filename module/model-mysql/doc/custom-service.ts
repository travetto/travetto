import { InjectableFactory } from '@travetto/di';
import { type MysqlConnection, MysqlModelService } from '@travetto/model-mysql';

export class Init {
  @InjectableFactory({ primary: true })
  static getModelService(connection: MysqlConnection) {
    return new MysqlModelService(connection);
  }
}
