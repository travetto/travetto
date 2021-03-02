import { Suite } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/test-support/basic';
import { ModelCrudSuite } from '@travetto/model/test-support/crud';
import { ModelIndexedSuite } from '@travetto/model/test-support/indexed';
import { ModelPolymorphismSuite } from '@travetto/model/test-support/polymorphism';

import { FirestoreModelConfig, FirestoreModelService } from '..';

@Suite()
export class FirestoreBasicSuite extends ModelBasicSuite {
  constructor() {
    super(FirestoreModelService, FirestoreModelConfig);
  }
}


@Suite()
export class FirestoreCrudSuite extends ModelCrudSuite {
  constructor() {
    super(FirestoreModelService, FirestoreModelConfig);
  }
}

@Suite()
export class FirestoreIndexedSuite extends ModelIndexedSuite {
  constructor() {
    super(FirestoreModelService, FirestoreModelConfig);
  }
}

@Suite()
export class FirestorePolymorphismSuite extends ModelPolymorphismSuite {
  constructor() {
    super(FirestoreModelService, FirestoreModelConfig);
  }
}