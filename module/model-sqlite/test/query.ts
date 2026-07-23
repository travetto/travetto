import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';
import { ModelQuerySuite } from '@travetto/model-query/support/test/query.ts';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest.ts';

import { SqliteModelConfig } from '../src/config.ts';
import { SqliteModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class SqliteQuerySuite extends ModelQuerySuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
  supportsGeo = false;
}

@WithSuiteContext()
@Suite()
class SqliteQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}
