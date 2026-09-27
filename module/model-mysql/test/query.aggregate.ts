import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryAggregateSuite } from '@travetto/model-query/support/test/aggregate.ts';

import { MysqlModelConfig } from '../src/config.ts';
import { MysqlModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class MySQLQueryAggregateSuite extends ModelQueryAggregateSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
