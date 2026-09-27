import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryTextSuite } from '@travetto/model-query/support/test/text.ts';

import { PostgresModelConfig } from '../src/config.ts';
import { PostgresModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class PostgreSQLQueryTextSuite extends ModelQueryTextSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}
