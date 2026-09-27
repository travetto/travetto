import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';

import { SqliteModelConfig } from '../src/config.ts';
import { SqliteModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class SqliteQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}
