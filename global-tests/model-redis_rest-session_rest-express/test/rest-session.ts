
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/support/test.server';
import { SessionModelⲐ } from '@travetto/rest-session';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { RedisModelService, RedisModelConfig } from '@travetto/model-redis';

class Config {
  @InjectableFactory(SessionModelⲐ)
  static model(svc: RedisModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class RedisRestSessionServerSuite extends RestSessionServerSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}
