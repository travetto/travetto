import { Suite } from '@travetto/test';

import { ModelQuerySuite } from '@travetto/model-query/support/test/query.ts';
import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud.ts';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet.ts';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism.ts';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest.ts';
import { ModelQueryCrudSupport } from '@travetto/model-query/src/service/crud.ts';
import { ModelQuerySuggestSupport } from '@travetto/model-query/src/service/suggest.ts';
import { ModelQueryFacetSupport } from '@travetto/model-query/src/service/facet.ts';
import { Config } from '@travetto/config';
import { Injectable } from '@travetto/di';

import { QueryModelService } from './query-service.ts';

@Config('model.custom')
class CustomModelConfig { }

@Injectable()
class CustomModelService extends QueryModelService implements ModelQueryCrudSupport, ModelQueryFacetSupport, ModelQuerySuggestSupport {
}

@Suite()
export class CustomQuerySuite extends ModelQuerySuite {
  serviceClass = CustomModelService;
  configClass = CustomModelConfig;
}

@Suite()
export class CustomQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = CustomModelService;
  configClass = CustomModelConfig;
}

@Suite()
export class CustomQueryFacetSuite extends ModelQueryFacetSuite {
  serviceClass = CustomModelService;
  configClass = CustomModelConfig;
}

@Suite()
export class CustomQueryPolymorphismSuite extends ModelQueryPolymorphismSuite {
  serviceClass = CustomModelService;
  configClass = CustomModelConfig;
}

@Suite()
export class CustomQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = CustomModelService;
  configClass = CustomModelConfig;
}