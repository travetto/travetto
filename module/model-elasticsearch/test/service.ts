import { Suite } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/test-support/basic';
import { ModelCrudSuite } from '@travetto/model/test-support/crud';
import { ModelBulkSuite } from '@travetto/model/test-support/bulk';
import { ModelIndexedSuite } from '@travetto/model/test-support/indexed';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

@Suite()
export class ElasticsearchBasicSuite extends ModelBasicSuite {
  constructor() {
    super(ElasticsearchModelService, ElasticsearchModelConfig);
  }
}

@Suite()
export class ElasticsearchCrudSuite extends ModelCrudSuite {
  constructor() {
    super(ElasticsearchModelService, ElasticsearchModelConfig);
  }
}

@Suite()
export class ElasticsearchIndexedSuite extends ModelIndexedSuite {
  constructor() {
    super(ElasticsearchModelService, ElasticsearchModelConfig);
  }
}

@Suite()
export class ElasticsearchBulkSuite extends ModelBulkSuite {
  constructor() {
    super(ElasticsearchModelService, ElasticsearchModelConfig);
  }
}