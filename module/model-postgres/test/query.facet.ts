import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';

import { PostgresModelConfig } from '../src/config.ts';
import { PostgresModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class PostgreSQLQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}
