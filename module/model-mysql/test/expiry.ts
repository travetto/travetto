import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';

import { MysqlModelConfig } from '../src/config.ts';
import { MysqlModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class MySQLExpirySuite extends ModelExpirySuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
