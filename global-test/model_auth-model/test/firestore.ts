import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { FirestoreModelConfig, FirestoreModelService } from '@travetto/model-firestore';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';

class Config {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: FirestoreModelConfig) {
    return new FirestoreModelService(config);
  }
}

@Suite()
class FirestoreAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}
