import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';

import { MysqlModelConfig } from '../src/config.ts';
import { MysqlModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class MySQLBulkSuite extends ModelBulkSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
