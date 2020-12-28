// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelSym } from '@travetto/auth-model';
import { AuthModelServiceSuite } from '@travetto/auth-model/test-support/service';

import { FirestoreModelConfig, FirestoreModelService } from '..';

class Init {
  @InjectableFactory(AuthModelSym)
  static modelProvider(config: FirestoreModelConfig) {
    return new FirestoreModelService(config);
  }
}

@Suite()
export class FirestoreAuthModelServiceSuite extends AuthModelServiceSuite {
  constructor() {
    super(FirestoreModelService, FirestoreModelConfig);
  }
}