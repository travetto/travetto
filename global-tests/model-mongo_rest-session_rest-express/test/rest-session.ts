
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/support/test.server';
import { SessionModelⲐ } from '@travetto/rest-session';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { MongoModelService, MongoModelConfig } from '@travetto/model-mongo';

class Config {
  @InjectableFactory(SessionModelⲐ)
  static model(svc: MongoModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class MongoRestSessionServerSuite extends RestSessionServerSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
