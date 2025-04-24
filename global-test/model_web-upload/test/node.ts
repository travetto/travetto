import { Suite } from '@travetto/test';
import { NodeWebApplication } from '@travetto/web-node';

import { FetchWebDispatcher } from '@travetto/web-node/support/test/dispatcher.ts';

import { ModelBlobWebUploadServerSuite } from './suite.ts';

@Suite()
export class NodeWebUploadTest extends ModelBlobWebUploadServerSuite {
  dispatcherType = FetchWebDispatcher;
  appType = NodeWebApplication;
}
