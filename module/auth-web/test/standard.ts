import { Suite } from '@travetto/test';

import { AuthWebServerSuite } from '@travetto/auth-web/support/test/server.ts';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';

@Suite()
class StandardAuthWebTest extends AuthWebServerSuite {
  dispatcherType = LocalRequestDispatcher;
}
