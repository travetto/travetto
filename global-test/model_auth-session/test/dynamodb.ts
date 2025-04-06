
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SessionModelSymbol } from '@travetto/auth-session';
import { DynamoDBModelService, DynamoDBModelConfig } from '@travetto/model-dynamodb';
import { NodeWebApplication } from '@travetto/web-node';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';
import { ModelSuite } from '@travetto/model/support/test/suite.ts';
import { NodeWeFetchRouter } from '@travetto/web-node/support/test/fetch-router.ts';

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
  routerType = NodeWeFetchRouter;
  appType = NodeWebApplication;
}
