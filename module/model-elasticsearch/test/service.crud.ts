import { Suite } from '@travetto/test';

import { ModelCrudSuite } from '@travetto/model/support/test/crud';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

@Suite()
export class ElasticsearchCrudSuite extends ModelCrudSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}