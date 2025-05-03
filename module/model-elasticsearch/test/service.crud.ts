import { Suite } from '@travetto/test';
import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';

import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';

@Suite()
export class ElasticsearchCrudSuite extends ModelCrudSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}