import { SessionModelSymbol } from '@travetto/auth-session';
import { InjectableFactory } from '@travetto/di';
import { DynamoDBModelConfig, DynamoDBModelService } from '@travetto/model-dynamodb';
import { Suite } from '@travetto/test';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';

class Config {
  @InjectableFactory(SessionModelSymbol)
  static model(svc: DynamoDBModelService) {
    return svc;
  }
}

@Suite()
class DynamoDBAuthSessionServerSuite extends AuthSessionServerSuite<DynamoDBModelService> {
  timeScale = 1.3;
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}
