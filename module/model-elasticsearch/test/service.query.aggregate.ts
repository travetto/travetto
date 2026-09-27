import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';
import { Suite } from '@travetto/test';

import { ModelQueryAggregateSuite } from '@travetto/model-query/support/test/aggregate.ts';

@Suite()
class ElasticsearchQueryAggregateSuite extends ModelQueryAggregateSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}
