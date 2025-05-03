import { Suite } from '@travetto/test';
import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';

import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';

@Suite()
export class ElasticsearchQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}