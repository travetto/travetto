import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { DynamoDBModelConfig, DynamoDBModelService } from '@travetto/model-dynamodb';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';

class Init {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: DynamoDBModelConfig) {
    return new DynamoDBModelService(config);
  }
}

@Suite()
export class DynamoDBAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}
