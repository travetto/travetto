import { Suite } from '@travetto/test';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism';

import { ElasticsearchModelConfig } from '../src/config';
import { ElasticsearchModelService } from '../src/service';

@Suite()
export class ElasticsearchQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}