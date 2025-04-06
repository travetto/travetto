
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SessionModelSymbol } from '@travetto/auth-session';
import { MongoModelService, MongoModelConfig } from '@travetto/model-mongo';
import { NodeWebApplication } from '@travetto/web-node';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';
import { ModelSuite } from '@travetto/model/support/test/suite.ts';
import { NodeWeFetchRouter } from '@travetto/web-node/support/test/fetch-router.ts';

class Config {
  @InjectableFactory(SessionModelSymbol)
  static model(svc: MongoModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class MongoAuthSessionServerSuite extends AuthSessionServerSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
  routerType = NodeWeFetchRouter;
  appType = NodeWebApplication;
}
