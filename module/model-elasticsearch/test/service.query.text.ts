import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';
import { Suite } from '@travetto/test';

import { ModelQueryTextSuite } from '@travetto/model-query/support/test/text.ts';

@Suite()
class ElasticsearchQueryTextSuite extends ModelQueryTextSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
  supportsStemming = false;
}
