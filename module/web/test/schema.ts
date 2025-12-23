import { Suite } from '@travetto/test';

import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';

@Suite()
class BasicSchemaTest extends SchemaWebServerSuite {
  dispatcherType = LocalRequestDispatcher;
}