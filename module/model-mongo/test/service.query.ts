import { Suite } from '@travetto/test';

import { ModelQuerySuite } from '@travetto/model-query/test-support/query';
import { ModelQueryCrudSuite } from '@travetto/model-query/test-support/crud';
import { ModelQueryFacetSuite } from '@travetto/model-query/test-support/facet';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/test-support/polymorphism';
import { ModelQuerySuggestSuite } from '@travetto/model-query/test-support/suggest';

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

@Suite()
export class MongoQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}

@Suite()
export class MongoQuerySuggestSuite extends ModelQuerySuggestSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}