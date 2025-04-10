import { Suite } from '@travetto/test';
import { StandardWebRouter } from '@travetto/web';

import { AuthWebServerSuite } from '../support/test/server.ts';

@Suite()
export class StandardAuthWebTest extends AuthWebServerSuite {
  dispatcherType = StandardWebRouter;
}
