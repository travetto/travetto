import { Suite } from '@travetto/test';
import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';

import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';

@Suite()
class ElasticsearchBasicSuite extends ModelBasicSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}