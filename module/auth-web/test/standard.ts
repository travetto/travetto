import { Suite } from '@travetto/test';
import { BasicWebDispatcher } from '@travetto/web/support/test/dispatcher.ts';

import { AuthWebServerSuite } from '../support/test/server.ts';

@Suite()
export class StandardAuthWebTest extends AuthWebServerSuite {
  dispatcherType = BasicWebDispatcher;
}
