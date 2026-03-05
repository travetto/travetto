
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SessionModelSymbol } from '@travetto/auth-session';
import { MongoModelService, MongoModelConfig } from '@travetto/model-mongo';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';

class Config {
  @InjectableFactory(SessionModelSymbol)
  static model(svc: MongoModelService) {
    return svc;
  }
}

@Suite()
class MongoAuthSessionServerSuite extends AuthSessionServerSuite<MongoModelService> {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
