// @with-module @travetto/rest-session
// @with-module @travetto/rest-express

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { SessionModelⲐ } from '@travetto/rest-session';
import { ModelSuite } from '@travetto/model/test-support/suite';

import { ElasticsearchModelService } from '../src/service';
import { ElasticsearchModelConfig } from '../src/config';

class Config {
  @InjectableFactory(SessionModelⲐ)
  static model(svc: ElasticsearchModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class ElasticsearchRestSessionServerSuite extends RestSessionServerSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}