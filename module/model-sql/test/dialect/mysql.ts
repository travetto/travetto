import { Suite } from '@travetto/test';
import { InjectableFactory } from '@travetto/di';
import { AsyncContext } from '@travetto/context';

import { ModelBasicSuite } from '@travetto/model/test-support/basic';
import { ModelCrudSuite } from '@travetto/model/test-support/crud';
import { ModelBulkSuite } from '@travetto/model/test-support/bulk';
import { WithSuiteContext } from '@travetto/context/test-support/suite-context';
import { ModelExpirySuite } from '@travetto/model/test-support/expiry';

import { SQLModelConfig, SQLModelService } from '../..';
import { MySQLDialect } from '../../src/dialect/mysql/dialect';
import { ModelPolymorphismSuite } from '@travetto/model/test-support/polymorphism';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
export class MySQLBasicSuite extends ModelBasicSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
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

@WithSuiteContext()
@Suite()
export class MySQLExpirySuite extends ModelExpirySuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}

@WithSuiteContext()
@Suite()
export class MySQLPolymorphismSuite extends ModelPolymorphismSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}