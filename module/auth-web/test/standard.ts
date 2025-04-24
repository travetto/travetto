import { Suite } from '@travetto/test';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';

import { AuthWebServerSuite } from '../support/test/server.ts';

@Suite()
export class StandardAuthWebTest extends AuthWebServerSuite {
  dispatcherType = LocalRequestDispatcher;
}
