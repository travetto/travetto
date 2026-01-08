import { Suite } from '@travetto/test';
import { InjectableFactory } from '@travetto/di';
import type { AsyncContext } from '@travetto/context';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { MySQLDialect } from '@travetto/model-mysql';

import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
class MySQLBasicSuite extends ModelBasicSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
class MySQLCrudSuite extends ModelCrudSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
class MySQLBulkSuite extends ModelBulkSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
class MySQLExpirySuite extends ModelExpirySuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
class MySQLPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}