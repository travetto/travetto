
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server';
import { SessionModelSymbol } from '@travetto/auth-session';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { ElasticsearchModelService, ElasticsearchModelConfig } from '@travetto/model-elasticsearch';

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
