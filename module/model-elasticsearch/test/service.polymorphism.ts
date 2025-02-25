import { Suite } from '@travetto/test';

import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

import { ElasticsearchModelConfig } from '../src/config.ts';
import { ElasticsearchModelService } from '../src/service.ts';

@Suite()
export class ElasticsearchPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}