import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

import { PostgresModelConfig } from '../src/config.ts';
import { PostgresModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class PostgreSQLBasicSuite extends ModelBasicSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLCrudSuite extends ModelCrudSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLQueryPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLBulkSuite extends ModelBulkSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLExpirySuite extends ModelExpirySuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}
