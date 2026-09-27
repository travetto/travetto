import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';
import { Suite } from '@travetto/test';

import { ModelQueryAggregateSuite } from '@travetto/model-query/support/test/aggregate.ts';

@Suite()
class MongoQueryAggregateSuite extends ModelQueryAggregateSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
