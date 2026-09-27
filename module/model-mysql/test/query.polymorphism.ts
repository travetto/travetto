import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';

import { MysqlModelConfig } from '../src/config.ts';
import { MysqlModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class MySQLQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
