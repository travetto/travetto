import { Suite } from '@travetto/test';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism';

@Suite()
class MemoryIndexedSuite extends ModelIndexedSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
class MemoryIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}
