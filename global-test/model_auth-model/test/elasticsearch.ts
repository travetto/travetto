import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';

class Init {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(config);
  }
}

@Suite()
export class ElasticsearchAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}
