import type { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { SqliteDialect } from '@travetto/model-sqlite';
import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new SqliteDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
class SqliteBasicSuite extends ModelBasicSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteCrudSuite extends ModelCrudSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteBulkSuite extends ModelBulkSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteExpirySuite extends ModelExpirySuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteQueryPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}
