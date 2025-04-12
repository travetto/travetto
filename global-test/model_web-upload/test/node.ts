import { Suite } from '@travetto/test';
import { NodeWebApplication } from '@travetto/web-node';

import { ModelBlobWebUploadServerSuite } from './suite.ts';
import { FetchWebDispatcher } from '@travetto/web-node/support/test/dispatcher.ts';

@Suite()
export class NodeWebUploadTest extends ModelBlobWebUploadServerSuite {
  dispatcherType = FetchWebDispatcher;
  appType = NodeWebApplication;
}
