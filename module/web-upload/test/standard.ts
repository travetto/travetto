import { Suite } from '@travetto/test';

import { WebUploadServerSuite } from '@travetto/web-upload/support/test/server.ts';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';

@Suite()
class StandardWebUploadTest extends WebUploadServerSuite {
  dispatcherType = LocalRequestDispatcher;
}
