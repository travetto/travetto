import { Suite } from '@travetto/test';

import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';

@Suite()
class BasicStandardTest extends StandardWebServerSuite {
  dispatcherType = LocalRequestDispatcher;
}