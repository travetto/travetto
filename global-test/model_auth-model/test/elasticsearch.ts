import { InjectableFactory } from '@travetto/di';
import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';

class Init {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(config);
  }
}

@Suite()
class ElasticsearchAuthModelServiceSuite extends AuthModelServiceSuite<ElasticsearchModelService> {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}
