
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SessionModelSymbol } from '@travetto/auth-session';
import { MongoModelService, MongoModelConfig } from '@travetto/model-mongo';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server';
import { ModelSuite } from '@travetto/model/support/test/suite';

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
