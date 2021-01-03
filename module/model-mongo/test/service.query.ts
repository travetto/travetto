import { Suite } from '@travetto/test';

import { ModelQuerySuite } from '@travetto/model-query/test-support/query';
import { ModelQueryCrudSuite } from '@travetto/model-query/test-support/crud';
import { ModelQueryFacetSuite } from '@travetto/model-query/test-support/facet';

import { MongoModelConfig, MongoModelService } from '..';

@Suite()
export class MongoQuerySuite extends ModelQuerySuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}

@Suite()
export class MongoQueryCrudSuite extends ModelQueryCrudSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}

@Suite()
export class MongoQueryFacetSuite extends ModelQueryFacetSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}