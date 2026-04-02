import { Suite } from '@travetto/test';
import { FirestoreModelConfig, FirestoreModelService } from '@travetto/model-firestore';

import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism.ts';

@Suite()
class FirestoreIndexedSuite extends ModelIndexedSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}

@Suite()
class FirestoreIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}
