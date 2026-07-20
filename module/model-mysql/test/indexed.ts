import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism.ts';

import { MysqlModelConfig } from '../src/config.ts';
import { MysqlModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class MySQLIndexedSuite extends ModelIndexedSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
  supportsDeepIndexes = true;
}

@WithSuiteContext()
@Suite()
class MySQLIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
