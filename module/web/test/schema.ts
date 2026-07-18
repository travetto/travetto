import { Suite } from '@travetto/test';

import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';
import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema.ts';

@Suite()
class BasicSchemaTest extends SchemaWebServerSuite {
  dispatcherType = LocalRequestDispatcher;
}
