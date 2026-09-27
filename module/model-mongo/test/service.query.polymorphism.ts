import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';
import { Suite } from '@travetto/test';

import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';

@Suite()
class MongoQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
