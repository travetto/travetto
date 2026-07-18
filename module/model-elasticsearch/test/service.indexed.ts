import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';
import { Suite } from '@travetto/test';

import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';

@Suite()
class ElasticsearchIndexedSuite extends ModelIndexedSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
  supportsUniqueIndexes = false;
}
