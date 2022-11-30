import { Suite } from '@travetto/test';

import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism';

import { ElasticsearchModelConfig } from '../src/config';
import { ElasticsearchModelService } from '../src/service';

@Suite()
export class ElasticsearchPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}