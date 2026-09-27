import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';
import { Suite } from '@travetto/test';

import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest.ts';

@Suite()
class MongoQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
