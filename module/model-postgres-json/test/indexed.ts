import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism.ts';

import { PostgresJsonModelConfig } from '../src/config.ts';
import { PostgresJsonModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class PostgreSQLJsonIndexedSuite extends ModelIndexedSuite {
  serviceClass = PostgresJsonModelService;
  configClass = PostgresJsonModelConfig;
  supportsDeepIndexes = true; // Yes! Our document store handles nested expression indexes natively.
}

@WithSuiteContext()
@Suite()
class PostgreSQLJsonIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = PostgresJsonModelService;
  configClass = PostgresJsonModelConfig;
}
