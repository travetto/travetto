import { Suite } from '@travetto/test';
import { ModelCrudSuite } from '@travetto/model-core/test-support/crud';
import { ModelBulkSuite } from '@travetto/model-core/test-support/bulk';

import { InjectableFactory } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';

import { SQLModelConfig, SQLModelService } from '../..';
import { PostgreSQLDialect } from '../../src/dialect/postgresql/dialect';
import { BaseQueryTest } from '../query';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
export class PostgreSQLCrudSuite extends ModelCrudSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}

@WithSuiteContext()
@Suite()
export class PostgreSQLBulkSuite extends ModelBulkSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}

@Suite()
export class PostgreSQLQueryTest extends BaseQueryTest {

}
