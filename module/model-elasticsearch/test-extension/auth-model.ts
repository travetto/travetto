// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelSym } from '@travetto/auth-model';
import { AuthModelServiceSuite } from '@travetto/auth-model/test-support/service';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

class Init {
  @InjectableFactory(AuthModelSym)
  static modelProvider(config: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(config);
  }
}

@Suite()
export class ElasticsearchAuthModelServiceSuite extends AuthModelServiceSuite {
  constructor() {
    super(ElasticsearchModelService, ElasticsearchModelConfig);
  }
}