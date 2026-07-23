import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism.ts';

import { PostgresModelConfig } from '../src/config.ts';
import { PostgresModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class PostgreSQLIndexedSuite extends ModelIndexedSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
  supportsDeepIndexes = true;
}

@WithSuiteContext()
@Suite()
class PostgreSQLIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = PostgresModelService;
  configClass = PostgresModelConfig;
}
