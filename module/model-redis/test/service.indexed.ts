import { Suite } from '@travetto/test';
import { RedisModelConfig, RedisModelService } from '@travetto/model-redis';

import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism.ts';

@Suite()
class RedisIndexedSuite extends ModelIndexedSuite {
  indexLimitSkew = 10;
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}

@Suite()
class RedisIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  indexLimitSkew = 10;
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}
