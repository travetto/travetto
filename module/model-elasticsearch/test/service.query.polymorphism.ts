import { Suite } from '@travetto/test';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

@Suite()
export class ElasticsearchQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}