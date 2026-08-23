import { Suite } from '@travetto/test';

import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism';

import { ElasticsearchModelConfig } from '../src/config.ts';
import { ElasticsearchModelService } from '../src/service.ts';

@Suite()
class ElasticsearchIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}
