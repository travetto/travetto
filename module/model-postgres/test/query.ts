import { Suite } from '@travetto/test';
import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';

import { WithSuiteContext } from '@travetto/context/support/test/context';
import { ModelQuerySuite } from '@travetto/model-query/support/test/query';
import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest';

import { PostgreSQLDialect } from '../src/dialect';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
export class PostgreSQLQuerySuite extends ModelQuerySuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
  supportsGeo = false;
}

@WithSuiteContext()
@Suite()
export class PostgreSQLQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class PostgreSQLQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class PostgreSQLQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class PostgreSQLQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}