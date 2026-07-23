import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism.ts';

import { SqliteModelConfig } from '../src/config.ts';
import { SqliteModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class SqliteIndexedSuite extends ModelIndexedSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
  supportsDeepIndexes = false;
}

@WithSuiteContext()
@Suite()
class SqliteIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}
