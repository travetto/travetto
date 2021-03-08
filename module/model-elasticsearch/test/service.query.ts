import { Suite } from '@travetto/test';

import { ModelQuerySuite } from '@travetto/model-query/test-support/query';
import { ModelQueryCrudSuite } from '@travetto/model-query/test-support/crud';
import { ModelQueryFacetSuite } from '@travetto/model-query/test-support/facet';
import { ModelQuerySuggestSuite } from '@travetto/model-query/test-support/suggest';

import { ElasticsearchModelConfig, ElasticsearchModelService } from '..';


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