
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SessionModelSymbol } from '@travetto/auth-session';
import { ElasticsearchModelService, ElasticsearchModelConfig } from '@travetto/model-elasticsearch';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';

class Config {
  @InjectableFactory(SessionModelSymbol)
  static model(svc: ElasticsearchModelService) {
    return svc;
  }
}

@Suite()
class ElasticsearchAuthSessionServerSuite extends AuthSessionServerSuite<ElasticsearchModelService> {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}
