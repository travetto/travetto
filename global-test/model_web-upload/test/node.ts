import { Suite } from '@travetto/test';
import { NodeWebApplication } from '@travetto/web-node';

import { ModelBlobWebUploadServerSuite } from './server.ts';
import { NodeWeFetchRouter } from '@travetto/web-node/support/test/fetch-router.ts';

@Suite()
export class NodeWebUploadTest extends ModelBlobWebUploadServerSuite {
  routerType = NodeWeFetchRouter;
  appType = NodeWebApplication;
}
