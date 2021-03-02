import { Suite } from '@travetto/test';

import { ModelQuerySuite } from '@travetto/model-query/test-support/query';
import { ModelQueryCrudSuite } from '@travetto/model-query/test-support/crud';
import { ModelQueryFacetSuite } from '@travetto/model-query/test-support/facet';
import { ModelQuerySuggestSuite } from '@travetto/model-query/test-support/suggest';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';


@Suite()
export class ElasticsearchQuerySuite extends ModelQuerySuite {
  constructor() {
    super(ElasticsearchModelService, ElasticsearchModelConfig);
  }
}

@Suite()
export class ElasticsearchQueryCrudSuite extends ModelQueryCrudSuite {
  constructor() {
    super(ElasticsearchModelService, ElasticsearchModelConfig);
  }
}

@Suite()
export class ElasticsearchQueryFacetSuite extends ModelQueryFacetSuite {
  constructor() {
    super(ElasticsearchModelService, ElasticsearchModelConfig);
  }
}

@Suite()
export class ElasticsearchQuerySuggestSuite extends ModelQuerySuggestSuite {
  constructor() {
    super(ElasticsearchModelService, ElasticsearchModelConfig);
  }
}