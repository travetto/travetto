import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';

import { MysqlModelConfig } from '../src/config.ts';
import { MysqlModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class MySQLCrudSuite extends ModelCrudSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
