import { Suite } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/support/test/basic';
import { ModelCrudSuite } from '@travetto/model/support/test/crud';
import { ModelIndexedSuite } from '@travetto/model/support/test/indexed';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism';

import { FirestoreModelConfig, FirestoreModelService } from '..';

@Suite()
export class FirestoreBasicSuite extends ModelBasicSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}


@Suite()
export class FirestoreCrudSuite extends ModelCrudSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}

@Suite()
export class FirestoreIndexedSuite extends ModelIndexedSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}

@Suite()
export class FirestorePolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}