import { Suite } from '@travetto/test';
import { ModelCrudSuite } from '@travetto/model-core/test/lib/crud';
import { ModelIndexedSuite } from '@travetto/model-core/test/lib/indexed';

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

