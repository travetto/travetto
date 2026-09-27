import { Suite } from '@travetto/test';

import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelQueryTextSuite } from '@travetto/model-query/support/test/text.ts';

import { SqliteModelConfig } from '../src/config.ts';
import { SqliteModelService } from '../src/service.ts';

@WithSuiteContext()
@Suite()
class SqliteQueryTextSuite extends ModelQueryTextSuite {
  serviceClass = SqliteModelService;
  configClass = SqliteModelConfig;
}
