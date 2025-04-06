import { Suite } from '@travetto/test';
import { BasicWebRouter } from '@travetto/web/support/test/test-router.ts';
import { WebUploadServerSuite } from '../support/test/server.ts';

@Suite()
export class StandardAuthWebTest extends WebUploadServerSuite {
  routerType = BasicWebRouter;
}
