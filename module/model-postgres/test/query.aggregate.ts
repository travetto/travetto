import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryAggregateSuite } from '@travetto/model-query/support/test/aggregate.ts';

import { PostgresModelConfig } from '../src/config.ts';
import { PostgresModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class PostgreSQLQueryAggregateSuite extends ModelQueryAggregateSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}
