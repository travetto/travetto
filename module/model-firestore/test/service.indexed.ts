import { Suite } from '@travetto/test';
import { FirestoreModelConfig, FirestoreModelService } from '@travetto/model-firestore';

import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism';

@Suite()
class FirestoreIndexedSuite extends ModelIndexedSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}

@Suite()
class FirestoreIndexedPolymorphicdSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}
