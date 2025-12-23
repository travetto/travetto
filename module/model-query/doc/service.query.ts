import { Suite } from '@travetto/test';
import { Config } from '@travetto/config';
import { Injectable } from '@travetto/di';
import { ModelQueryFacetSupport, ModelQuerySuggestSupport, ModelQueryCrudSupport } from '@travetto/model-query';

import { ModelQuerySuite } from '@travetto/model-query/support/test/query.ts';
import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest.ts';

import { QueryModelService } from './query-service.ts';

@Config('model.custom')
class CustomModelConfig { }

@Injectable()
class CustomModelService extends QueryModelService implements ModelQueryCrudSupport, ModelQueryFacetSupport, ModelQuerySuggestSupport {
}

@Suite()
class CustomQuerySuite extends ModelQuerySuite {
  serviceClass = CustomModelService;
  configClass = CustomModelConfig;
}

@Suite()
class CustomQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = CustomModelService;
  configClass = CustomModelConfig;
}

@Suite()
class CustomQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = CustomModelService;
  configClass = CustomModelConfig;
}

@Suite()
class CustomQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = CustomModelService;
  configClass = CustomModelConfig;
}

@Suite()
class CustomQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = CustomModelService;
  configClass = CustomModelConfig;
}