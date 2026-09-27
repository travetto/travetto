import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';

import { MysqlModelConfig } from '../src/config.ts';
import { MysqlModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class MySQLQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
