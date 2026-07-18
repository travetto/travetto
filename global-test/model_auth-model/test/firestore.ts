import { InjectableFactory } from '@travetto/di';
import { FirestoreModelConfig, FirestoreModelService } from '@travetto/model-firestore';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';

class Config {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: FirestoreModelConfig) {
    return new FirestoreModelService(config);
  }
}

@Suite()
class FirestoreAuthModelServiceSuite extends AuthModelServiceSuite<FirestoreModelService> {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}
