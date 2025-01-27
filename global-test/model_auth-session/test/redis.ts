
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server';
import { SessionModelSymbol } from '@travetto/auth-session';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { RedisModelService, RedisModelConfig } from '@travetto/model-redis';

class Config {
  @InjectableFactory(SessionModelSymbol)
  static model(svc: RedisModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class RedisAuthSessionServerSuite extends AuthSessionServerSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}
