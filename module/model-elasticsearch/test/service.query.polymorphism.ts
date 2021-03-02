import { Suite } from '@travetto/test';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/test-support/polymorphism';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

@Suite()
export class ElasticsearchQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  constructor() {
    super(ElasticsearchModelService, ElasticsearchModelConfig);
  }
}