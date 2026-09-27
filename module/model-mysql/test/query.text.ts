import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryTextSuite } from '@travetto/model-query/support/test/text.ts';

import { MysqlModelConfig } from '../src/config.ts';
import { MysqlModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class MySQLQueryTextSuite extends ModelQueryTextSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
  supportsStemming = false;
}
