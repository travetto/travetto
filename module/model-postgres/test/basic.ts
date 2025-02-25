import { Suite } from '@travetto/test';
import { InjectableFactory } from '@travetto/di';
import { AsyncContext } from '@travetto/context';

import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';

import { PostgreSQLDialect } from '../src/dialect.ts';

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