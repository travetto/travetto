// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { FirestoreModelConfig, FirestoreModelService } from '../..';
import { Suite } from '@travetto/test';
import { AuthModelSymbol } from '@travetto/auth-model';
import { AuthModelServiceSuite } from '@travetto/auth-model/test/lib/service';

class Init {
  @InjectableFactory(AuthModelSymbol)
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