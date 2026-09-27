import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQuerySuggestSuite } from '@travetto/model-query/support/test/suggest.ts';

import { SqliteModelConfig } from '../src/config.ts';
import { SqliteModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class SqliteQuerySuggestSuite extends ModelQuerySuggestSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}
