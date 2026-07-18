import { Suite } from '@travetto/test';

import { ElasticsearchModelConfig } from '../src/config.ts';
import { ElasticsearchModelService } from '../src/service.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism';

@Suite()
class ElasticsearchIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}
