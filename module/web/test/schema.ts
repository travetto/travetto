import { Suite } from '@travetto/test';

import { SchemaWebServerSuite } from '../support/test/suite/schema';
import { LocalRequestDispatcher } from '../support/test/dispatcher.ts';

@Suite()
export class BasicSchemaTest extends SchemaWebServerSuite {
  dispatcherType = LocalRequestDispatcher;
}