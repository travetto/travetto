import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';
import { Suite } from '@travetto/test';

import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';

@Suite()
class ElasticsearchBulkSuite extends ModelBulkSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}
