import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';
import { Suite } from '@travetto/test';

import { ModelQueryCrudSuite } from '@travetto/model-query/support/test/crud.ts';

@Suite()
class MongoQueryCrudSuite extends ModelQueryCrudSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
