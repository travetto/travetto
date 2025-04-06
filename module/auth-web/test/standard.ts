import { Suite } from '@travetto/test';
import { BasicWebRouter } from '@travetto/web/support/test/test-router.ts';

import { AuthWebServerSuite } from '../support/test/server.ts';

@Suite()
export class StandardAuthWebTest extends AuthWebServerSuite {
  routerType = BasicWebRouter;
}
