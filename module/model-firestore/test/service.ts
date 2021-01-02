import { Suite } from '@travetto/test';
import { ModelCrudSuite } from '@travetto/model/test-support/crud';
import { ModelIndexedSuite } from '@travetto/model/test-support/indexed';

import { FirestoreModelConfig, FirestoreModelService } from '..';

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

