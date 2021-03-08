// @file-if @travetto/rest-session
// @file-if @travetto/rest-express

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { SessionModelSym, ModelSessionProvider } from '@travetto/rest-session';
import { ModelSuite } from '@travetto/model/test-support/suite';

import { ElasticsearchModelService } from '../src/service';
import { ElasticsearchModelConfig } from '../src/config';

class Config {
  @InjectableFactory(SessionModelSym)
  static model(svc: ElasticsearchModelService) {
    return svc;
  }

  @InjectableFactory({ primary: true })
  static provider() {
    return new ModelSessionProvider();
  }
}

@Suite()
@ModelSuite()
export class ElasticsearchRestSesisonServerSuite extends RestSessionServerSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}