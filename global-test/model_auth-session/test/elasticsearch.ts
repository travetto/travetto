
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SessionModelSymbol } from '@travetto/auth-session';
import { ElasticsearchModelService, ElasticsearchModelConfig } from '@travetto/model-elasticsearch';
import { NodeWebApplication } from '@travetto/web-node';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';
import { ModelSuite } from '@travetto/model/support/test/suite.ts';
import { NodeWeFetchRouter } from '@travetto/web-node/support/test/fetch-router.ts';

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
  routerType = NodeWeFetchRouter;
  appType = NodeWebApplication;

}
