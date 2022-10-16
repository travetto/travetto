// @with-module @travetto/auth-model
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcⲐ } from '@travetto/auth-model/support/test/model';

import { FirestoreModelConfig, FirestoreModelService } from '..';

class Init {
  @InjectableFactory(TestModelSvcⲐ)
  static modelProvider(config: FirestoreModelConfig) {
    return new FirestoreModelService(config);
  }
}

@Suite()
export class FirestoreAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}