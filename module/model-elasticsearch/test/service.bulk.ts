import { Suite } from '@travetto/test';
import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';

import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';

@Suite()
class ElasticsearchBulkSuite extends ModelBulkSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}