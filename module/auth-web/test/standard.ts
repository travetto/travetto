import { Suite } from '@travetto/test';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';
import { AuthWebServerSuite } from '@travetto/auth-web/support/test/server.ts';

@Suite()
class StandardAuthWebTest extends AuthWebServerSuite {
  dispatcherType = LocalRequestDispatcher;
}
