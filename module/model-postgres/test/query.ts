import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';
import { ModelQuerySuite } from '@travetto/model-query/support/test/query.ts';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest.ts';

import { PostgresModelConfig } from '../src/config.ts';
import { PostgresModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class PostgreSQLQuerySuite extends ModelQuerySuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
  supportsGeo = false;
}

@WithSuiteContext()
@Suite()
class PostgreSQLQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}
