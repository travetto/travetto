
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SessionModelSymbol } from '@travetto/auth-session';
import { ElasticsearchModelService, ElasticsearchModelConfig } from '@travetto/model-elasticsearch';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server';
import { ModelSuite } from '@travetto/model/support/test/suite';

class Config {
  @InjectableFactory(SessionModelSymbol)
  static model(svc: ElasticsearchModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class ElasticsearchAuthSessionServerSuite extends AuthSessionServerSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}
