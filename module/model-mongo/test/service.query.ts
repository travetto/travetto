import { Suite } from '@travetto/test';

import { ModelQuerySuite } from '@travetto/model-query/test-support/query';
import { ModelQueryCrudSuite } from '@travetto/model-query/test-support/crud';
import { ModelQueryFacetSuite } from '@travetto/model-query/test-support/facet';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/test-support/polymorphism';
import { ModelQuerySuggestSuite } from '@travetto/model-query/test-support/suggest';

import { MongoModelConfig, MongoModelService } from '..';

@Suite()
export class MongoQuerySuite extends ModelQuerySuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
export class MongoQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
export class MongoQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
export class MongoQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
export class MongoQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}