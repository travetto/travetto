import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/test-support/suite-context';
import { ModelQuerySuite } from '@travetto/model-query/test-support/query';
import { ModelQueryCrudSuite } from '@travetto/model-query/test-support/crud';
import { ModelQueryFacetSuite } from '@travetto/model-query/test-support/facet';

import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';

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
export class PostgreSQLQuerySuite extends ModelQuerySuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
    this.supportsGeo = false;
  }
}

@WithSuiteContext()
@Suite()
export class PostgreSQLQueryCrudSuite extends ModelQueryCrudSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}

@WithSuiteContext()
@Suite()
export class PostgreSQLQueryFacetSuite extends ModelQueryFacetSuite {
  constructor() {
    super(SQLModelService, SQLModelConfig);
  }
}