import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';
import { Suite } from '@travetto/test';

import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';

@Suite()
class MongoQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
