import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcⲐ } from '@travetto/auth-model/support/test/model';

import { DynamoDBModelConfig, DynamoDBModelService } from '@travetto/model-dynamodb';

class Init {
  @InjectableFactory(TestModelSvcⲐ)
  static modelProvider(config: DynamoDBModelConfig) {
    return new DynamoDBModelService(config);
  }
}

@Suite()
export class DynamoDBAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}
