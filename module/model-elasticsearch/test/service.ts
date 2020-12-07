import { Suite } from '@travetto/test';
import { ModelCrudSuite } from '@travetto/model-core/test/lib/crud';
import { ModelBulkSuite } from '@travetto/model-core/test/lib/bulk';
import { ModelIndexedSuite } from '@travetto/model-core/test/lib/indexed';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';

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