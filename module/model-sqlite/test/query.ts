import { Suite } from '@travetto/test';
import { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQuerySuite } from '@travetto/model-query/support/test/query.ts';
import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest.ts';

import { SqliteDialect } from '../src/dialect.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new SqliteDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
export class SqliteQuerySuite extends ModelQuerySuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
  supportsGeo = false;
}

@WithSuiteContext()
@Suite()
export class SqliteQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class SqliteQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class SqliteQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
export class SqliteQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}