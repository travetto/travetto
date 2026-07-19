import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';
import { ModelQuerySuite } from '@travetto/model-query/support/test/query.ts';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest.ts';

import { PostgresJsonModelConfig } from '../src/config.ts';
import { PostgresJsonModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class PostgreSQLJsonQuerySuite extends ModelQuerySuite {
  serviceClass = PostgresJsonModelService;
  configClass = PostgresJsonModelConfig;
  supportsGeo = false;
}

@WithSuiteContext()
@Suite()
class PostgreSQLJsonQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = PostgresJsonModelService;
  configClass = PostgresJsonModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLJsonQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = PostgresJsonModelService;
  configClass = PostgresJsonModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLJsonQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = PostgresJsonModelService;
  configClass = PostgresJsonModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLJsonQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = PostgresJsonModelService;
  configClass = PostgresJsonModelConfig;
}
