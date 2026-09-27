import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';

import { PostgresModelConfig } from '../src/config.ts';
import { PostgresModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class PostgreSQLQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}
