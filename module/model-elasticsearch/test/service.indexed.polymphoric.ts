import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism';
import { Suite } from '@travetto/test';

import { ElasticsearchModelService } from '../src/service.ts';
import { ElasticsearchModelConfig } from '../src/config.ts';

@Suite()
class ElasticsearchIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}