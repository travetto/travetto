import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

import { MysqlModelConfig } from '../src/config.ts';
import { MysqlModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class MySQLBasicSuite extends ModelBasicSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}

@WithSuiteContext()
@Suite()
class MySQLCrudSuite extends ModelCrudSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}

@WithSuiteContext()
@Suite()
class MySQLQueryPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}

@WithSuiteContext()
@Suite()
class MySQLBulkSuite extends ModelBulkSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}

@WithSuiteContext()
@Suite()
class MySQLExpirySuite extends ModelExpirySuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
