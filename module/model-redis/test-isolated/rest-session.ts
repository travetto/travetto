// @file-if @travetto/rest-session
// @file-if @travetto/rest-express

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { SessionModelⲐ } from '@travetto/rest-session';
import { ModelSuite } from '@travetto/model/test-support/suite';

import { RedisModelService } from '../src/service';
import { RedisModelConfig } from '../src/config';

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