import { Suite } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelIndexedSuite } from '@travetto/model/support/test/indexed.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

import { FirestoreModelConfig } from '../src/config.ts';
import { FirestoreModelService } from '../src/service.ts';

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