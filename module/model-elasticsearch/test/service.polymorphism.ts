import { Suite } from '@travetto/test';

import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

@Suite()
export class ElasticsearchPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}