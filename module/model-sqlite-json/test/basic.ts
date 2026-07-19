import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

import { SqliteJsonModelConfig } from '../src/config.ts';
import { SqliteJsonModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class SQLiteJsonBasicSuite extends ModelBasicSuite {
  serviceClass = SqliteJsonModelService;
  configClass = SqliteJsonModelConfig;
}

@WithSuiteContext()
@Suite()
class SQLiteJsonCrudSuite extends ModelCrudSuite {
  serviceClass = SqliteJsonModelService;
  configClass = SqliteJsonModelConfig;
}

@WithSuiteContext()
@Suite()
class SQLiteJsonQueryPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = SqliteJsonModelService;
  configClass = SqliteJsonModelConfig;
}

@WithSuiteContext()
@Suite()
class SQLiteJsonBulkSuite extends ModelBulkSuite {
  serviceClass = SqliteJsonModelService;
  configClass = SqliteJsonModelConfig;
}

@WithSuiteContext()
@Suite()
class SQLiteJsonExpirySuite extends ModelExpirySuite {
  serviceClass = SqliteJsonModelService;
  configClass = SqliteJsonModelConfig;
}
