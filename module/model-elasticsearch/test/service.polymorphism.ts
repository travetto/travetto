import { Suite } from '@travetto/test';

import { ModelPolymorphismSuite } from '@travetto/model/test-support/polymorphism';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

@Suite()
export class ElasticsearchPolymorphismSuite extends ModelPolymorphismSuite {
  constructor() {
    super(ElasticsearchModelService, ElasticsearchModelConfig);
  }
}