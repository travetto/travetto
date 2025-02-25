
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';
import { SessionModelSymbol } from '@travetto/auth-session';
import { ModelSuite } from '@travetto/model/support/test/suite.ts';

import { MongoModelService, MongoModelConfig } from '@travetto/model-mongo';

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
}
