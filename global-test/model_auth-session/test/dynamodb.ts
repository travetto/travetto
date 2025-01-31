
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server';
import { SessionModelSymbol } from '@travetto/auth-session';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { DynamoDBModelService, DynamoDBModelConfig } from '@travetto/model-dynamodb';

class Config {
  @InjectableFactory(SessionModelSymbol)
  static model(svc: DynamoDBModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class DynamoDBAuthSessionServerSuite extends AuthSessionServerSuite {
  timeScale = 1.3;
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}
