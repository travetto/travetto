// @file-if @travetto/auth-model

import { InjectableFactory } from '@travetto/di';
import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';
import { Suite } from '@travetto/test';
import { AuthModelSymbol } from '@travetto/auth-model';
import { AuthModelServiceSuite } from '@travetto/auth-model/test/lib/service';

class Init {
  @InjectableFactory(AuthModelSymbol)
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