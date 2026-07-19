import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism.ts';

import { SqliteJsonModelConfig } from '../src/config.ts';
import { SqliteJsonModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class SQLiteJsonIndexedSuite extends ModelIndexedSuite {
  serviceClass = SqliteJsonModelService;
  configClass = SqliteJsonModelConfig;
  supportsDeepIndexes = true; // Yes! SQLite supports indexes on expression paths.
}

@WithSuiteContext()
@Suite()
class SQLiteJsonIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = SqliteJsonModelService;
  configClass = SqliteJsonModelConfig;
}
