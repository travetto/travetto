import { Suite } from '@travetto/test';
import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';

import { ModelIndexedSuite } from '@travetto/model/support/test/indexed.ts';

@Suite()
export class ElasticsearchIndexedSuite extends ModelIndexedSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}