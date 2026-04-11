import { Suite } from '@travetto/test';
import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';
import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism.ts';

@Suite()
class MongoIndexedSuite extends ModelIndexedSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}


@Suite()
class MongoIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
