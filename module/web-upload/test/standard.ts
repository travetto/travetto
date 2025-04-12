import { Suite } from '@travetto/test';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';
import { WebUploadServerSuite } from '../support/test/server.ts';

@Suite()
export class StandardWebUploadTest extends WebUploadServerSuite {
  dispatcherType = LocalRequestDispatcher;
}
