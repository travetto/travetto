import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';

import { MysqlModelConfig } from '../src/config.ts';
import { MysqlModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class MySQLBasicSuite extends ModelBasicSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
