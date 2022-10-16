// @with-module @travetto/auth-model
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcⲐ } from '@travetto/auth-model/support/test/model';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

class Init {
  @InjectableFactory(TestModelSvcⲐ)
  static modelProvider(config: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(config);
  }
}

@Suite()
export class ElasticsearchAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}