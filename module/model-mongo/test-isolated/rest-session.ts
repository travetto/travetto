// @file-if @travetto/rest-session
// @file-if @travetto/rest-express

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { SessionModelⲐ } from '@travetto/rest-session';
import { ModelSuite } from '@travetto/model/test-support/suite';

import { MongoModelService } from '../src/service';
import { MongoModelConfig } from '../src/config';

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