// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcSym } from '@travetto/auth-model/test-support/service';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

class Init {
  @InjectableFactory(TestModelSvcSym)
  static modelProvider(config: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(config);
  }
}

@Suite()
export class ElasticsearchAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}