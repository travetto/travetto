import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model';

import { FirestoreModelConfig, FirestoreModelService } from '@travetto/model-firestore';

class Init {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: FirestoreModelConfig) {
    return new FirestoreModelService(config);
  }
}

@Suite()
export class FirestoreAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}
