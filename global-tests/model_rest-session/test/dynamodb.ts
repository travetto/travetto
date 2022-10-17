
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/support/test.server';
import { SessionModelⲐ } from '@travetto/rest-session';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { DynamoDBModelService, DynamoDBModelConfig } from '@travetto/model-dynamodb';

class Config {
  @InjectableFactory(SessionModelⲐ)
  static model(svc: DynamoDBModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class DynamoDBRestSessionServerSuite extends RestSessionServerSuite {
  serviceClass = DynamoDBModelService;
  configClass = DynamoDBModelConfig;
}
