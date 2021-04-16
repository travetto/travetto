// @file-if @travetto/rest-session
// @file-if @travetto/rest-express

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { SessionModelSym } from '@travetto/rest-session';
import { ModelSuite } from '@travetto/model/test-support/suite';

import { DynamoDBModelService } from '../src/service';
import { DynamoDBModelConfig } from '../src/config';

class Config {
  @InjectableFactory(SessionModelSym)
  static model(svc: DynamoDBModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class DynamoDBRestSesisonServerSuite extends RestSessionServerSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}