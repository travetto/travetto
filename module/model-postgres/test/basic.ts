import { Suite } from '@travetto/test';
import { InjectableFactory } from '@travetto/di';
import { AsyncContext } from '@travetto/context';

import { ModelCrudSuite } from '@travetto/model/support/test/crud';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk';
import { ModelBasicSuite } from '@travetto/model/support/test/basic';
import { WithSuiteContext } from '@travetto/context/support/test/context';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';

import { PostgreSQLDialect } from '../src/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
export class PostgreSQLBasicSuite extends ModelBasicSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class PostgreSQLCrudSuite extends ModelCrudSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class PostgreSQLBulkSuite extends ModelBulkSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class PostgreSQLExpirySuite extends ModelExpirySuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class PostgreSQLQueryPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}