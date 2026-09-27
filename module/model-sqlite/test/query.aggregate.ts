import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryAggregateSuite } from '@travetto/model-query/support/test/aggregate.ts';

import { SqliteModelConfig } from '../src/config.ts';
import { SqliteModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class SqliteQueryAggregateSuite extends ModelQueryAggregateSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}
