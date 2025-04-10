import { Suite } from '@travetto/test';
import { StandardWebRouter } from '@travetto/web';

import { WebUploadServerSuite } from '../support/test/server.ts';

@Suite()
export class StandardAuthWebTest extends WebUploadServerSuite {
  dispatcherType = StandardWebRouter;
}
