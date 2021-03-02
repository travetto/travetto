import { Suite } from '@travetto/test';
import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';

import { WithSuiteContext } from '@travetto/context/test-support/suite-context';
import { ModelQuerySuite } from '@travetto/model-query/test-support/query';
import { ModelQueryCrudSuite } from '@travetto/model-query/test-support/crud';
import { ModelQueryFacetSuite } from '@travetto/model-query/test-support/facet';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/test-support/polymorphism';
import { ModelQuerySuggestSuite } from '@travetto/model-query/test-support/suggest';

import { SQLModelConfig, SQLModelService } from '../..';
import { MySQLDialect } from '../../src/dialect/mysql/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new MySQLDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
export class MysqlQuerySuite extends ModelQuerySuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
    this.supportsGeo = false;
  }
}

@WithSuiteContext()
@Suite()
export class MysqlQueryCrudSuite extends ModelQueryCrudSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}

@WithSuiteContext()
@Suite()
export class MysqlQueryFacetSuite extends ModelQueryFacetSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}

@WithSuiteContext()
@Suite()
export class MySQLQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}

@WithSuiteContext()
@Suite()
export class MySQLQuerySuggestSuite extends ModelQuerySuggestSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}