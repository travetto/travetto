import { Suite } from '@travetto/test';
import { Config } from '@travetto/config';
import { Injectable } from '@travetto/di';

import { ModelQueryCrudSupport, ModelQuerySuggestSupport, ModelQueryFacetSupport } from '@travetto/model-query';

import { ModelQuerySuite } from '@travetto/model-query/support/test/query';
import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud';
import { ModelQueryFacetSuite } from '@travetto/model-query/support/test/facet';
import { ModelQueryPolymorphismSuite } from '@travetto/model-query/support/test/polymorphism';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest';

import { QueryModelService } from './query-service';

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