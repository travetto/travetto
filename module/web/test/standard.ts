import { Suite } from '@travetto/test';

import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';
import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';

@Suite()
class BasicStandardTest extends StandardWebServerSuite {
  dispatcherType = LocalRequestDispatcher;
}
