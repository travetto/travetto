import { Suite } from '@travetto/test';
import { ModelCrudSuite } from '@travetto/model/test-support/crud';
import { ModelBulkSuite } from '@travetto/model/test-support/bulk';

import { InjectableFactory } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';

import { SQLModelConfig, SQLModelService } from '../..';
import { MySQLDialect } from '../../src/dialect/mysql/dialect';
import { BaseQueryTest } from '../query';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
export class MySQLCrudSuite extends ModelCrudSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}

@WithSuiteContext()
@Suite()
export class MySQLBulkSuite extends ModelBulkSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}

@Suite()
export class MySQLQueryTest extends BaseQueryTest {

}
