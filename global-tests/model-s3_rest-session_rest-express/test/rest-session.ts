
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/support/test.server';
import { SessionModelⲐ } from '@travetto/rest-session';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { S3ModelService, S3ModelConfig } from '@travetto/model-s3';

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
