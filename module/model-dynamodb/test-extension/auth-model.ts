// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelSym } from '@travetto/auth-model';
import { AuthModelServiceSuite } from '@travetto/auth-model/test-support/service';

import { DynamoDBModelConfig, DynamoDBModelService } from '..';

class Init {
  @InjectableFactory(AuthModelSym)
  static modelProvider(config: DynamoDBModelConfig) {
    return new DynamoDBModelService(config);
  }
}

@Suite()
export class DynamoDBAuthModelServiceSuite extends AuthModelServiceSuite {
  constructor() {
    super(DynamoDBModelService, DynamoDBModelConfig);
  }
}