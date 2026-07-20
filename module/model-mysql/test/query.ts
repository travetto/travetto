import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';
import { ModelQuerySuite } from '@travetto/model-query/support/test/query.ts';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest.ts';

import { MysqlModelConfig } from '../src/config.ts';
import { MysqlModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class MySQLQuerySuite extends ModelQuerySuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
  supportsGeo = false;
}

@WithSuiteContext()
@Suite()
class MySQLQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}

@WithSuiteContext()
@Suite()
class MySQLQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}

@WithSuiteContext()
@Suite()
class MySQLQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}

@WithSuiteContext()
@Suite()
class MySQLQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
