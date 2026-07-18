import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';
import { Suite } from '@travetto/test';

import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

@Suite()
class ElasticsearchPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}
