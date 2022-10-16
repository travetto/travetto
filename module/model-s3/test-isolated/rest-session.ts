// @with-module @travetto/rest-session
// @with-module @travetto/rest-express

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/support/test.server';
import { SessionModelⲐ } from '@travetto/rest-session';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { S3ModelService } from '../src/service';
import { S3ModelConfig } from '../src/config';

class Config {
  @InjectableFactory(SessionModelⲐ)
  static model(svc: S3ModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class S3RestSessionServerSuite extends RestSessionServerSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}