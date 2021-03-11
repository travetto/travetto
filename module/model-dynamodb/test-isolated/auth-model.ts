// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcSym } from '@travetto/auth-model/test-support/service';

import { DynamoDBModelConfig, DynamoDBModelService } from '..';

class Init {
  @InjectableFactory(TestModelSvcSym)
  static modelProvider(config: DynamoDBModelConfig) {
    return new DynamoDBModelService(config);
  }
}

@Suite()
export class DynamoDBAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}