import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

import { PostgresJsonModelConfig } from '../src/config.ts';
import { PostgresJsonModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class PostgreSQLJsonBasicSuite extends ModelBasicSuite {
  serviceClass = PostgresJsonModelService;
  configClass = PostgresJsonModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLJsonCrudSuite extends ModelCrudSuite {
  serviceClass = PostgresJsonModelService;
  configClass = PostgresJsonModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLJsonQueryPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = PostgresJsonModelService;
  configClass = PostgresJsonModelConfig;
}
