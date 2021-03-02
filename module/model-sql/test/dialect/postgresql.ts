import { Suite } from '@travetto/test';
import { InjectableFactory } from '@travetto/di';
import { AsyncContext } from '@travetto/context';

import { ModelCrudSuite } from '@travetto/model/test-support/crud';
import { ModelBulkSuite } from '@travetto/model/test-support/bulk';
import { ModelBasicSuite } from '@travetto/model/test-support/basic';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';
import { ModelExpirySuite } from '@travetto/model/test-support/expiry';
import { ModelPolymorphismSuite } from '@travetto/model/test-support/polymorphism';

import { SQLModelConfig, SQLModelService } from '../..';
import { PostgreSQLDialect } from '../../src/dialect/postgresql/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
export class PostgeSQLBasicSuite extends ModelBasicSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
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

@WithSuiteContext()
@Suite()
export class PostgreSQLExpirySuite extends ModelExpirySuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}

@WithSuiteContext()
@Suite()
export class PostgreSQLQueryPolymorphismSuite extends ModelPolymorphismSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}