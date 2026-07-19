import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';
import { ModelQuerySuite } from '@travetto/model-query/support/test/query.ts';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest.ts';

import { SqliteJsonModelConfig } from '../src/config.ts';
import { SqliteJsonModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class SQLiteJsonQuerySuite extends ModelQuerySuite {
  serviceClass = SqliteJsonModelService;
  configClass = SqliteJsonModelConfig;
  supportsGeo = false;
}

@WithSuiteContext()
@Suite()
class SQLiteJsonQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = SqliteJsonModelService;
  configClass = SqliteJsonModelConfig;
}

@WithSuiteContext()
@Suite()
class SQLiteJsonQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = SqliteJsonModelService;
  configClass = SqliteJsonModelConfig;
}

@WithSuiteContext()
@Suite()
class SQLiteJsonQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = SqliteJsonModelService;
  configClass = SqliteJsonModelConfig;
}

@WithSuiteContext()
@Suite()
class SQLiteJsonQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = SqliteJsonModelService;
  configClass = SqliteJsonModelConfig;
}
