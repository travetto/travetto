import { Suite } from '@travetto/test';
import { InjectableFactory } from '@travetto/di';
import { AsyncContext } from '@travetto/context';

import { ModelBasicSuite } from '@travetto/model/support/test/basic';
import { ModelCrudSuite } from '@travetto/model/support/test/crud';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk';
import { WithSuiteContext } from '@travetto/context/support/test.context';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';

import { MySQLDialect } from '../src/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
export class MySQLBasicSuite extends ModelBasicSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class MySQLCrudSuite extends ModelCrudSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class MySQLBulkSuite extends ModelBulkSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class MySQLExpirySuite extends ModelExpirySuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class MySQLPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}