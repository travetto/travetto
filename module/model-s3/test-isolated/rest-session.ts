// @file-if @travetto/rest-session
// @file-if @travetto/rest-express

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { SessionModelSym } from '@travetto/rest-session';
import { ModelSuite } from '@travetto/model/test-support/suite';

import { S3ModelService } from '../src/service';
import { S3ModelConfig } from '../src/config';

class Config {
  @InjectableFactory(SessionModelSym)
  static model(svc: S3ModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class S3RestSesisonServerSuite extends RestSessionServerSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}