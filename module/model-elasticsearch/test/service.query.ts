import { Suite } from '@travetto/test';
import { ElasticsearchModelConfig, ElasticsearchModelService } from '@travetto/model-elasticsearch';

import { ModelQuerySuite } from '@travetto/model-query/support/test/query.ts';
import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest.ts';

@Suite()
export class ElasticsearchQuerySuite extends ModelQuerySuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}

@Suite()
export class ElasticsearchQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}

@Suite()
export class ElasticsearchQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}

@Suite()
export class ElasticsearchQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = ElasticsearchModelService;
  configClass = ElasticsearchModelConfig;
}