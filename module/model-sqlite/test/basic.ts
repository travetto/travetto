import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

import { SqliteModelConfig } from '../src/config.ts';
import { SqliteModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class SqliteBasicSuite extends ModelBasicSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteCrudSuite extends ModelCrudSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteQueryPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteBulkSuite extends ModelBulkSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}

@WithSuiteContext()
@Suite()
class SqliteExpirySuite extends ModelExpirySuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}
