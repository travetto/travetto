
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SessionModelSymbol } from '@travetto/auth-session';
import { DynamoDBModelService, DynamoDBModelConfig } from '@travetto/model-dynamodb';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';
import { ModelSuite } from '@travetto/model/support/test/suite.ts';
import { NodeWebServerSupport } from '@travetto/web-node/support/test/server-support.ts';

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
  type = NodeWebServerSupport;
}
