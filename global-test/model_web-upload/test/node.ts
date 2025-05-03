import { Suite } from '@travetto/test';
import { NodeWebApplication } from '@travetto/web-node';
import { DependencyRegistry } from '@travetto/di';

import { FetchWebDispatcher } from '@travetto/web-node/support/test/dispatcher.ts';

import { ModelBlobWebUploadServerSuite } from './suite.ts';

@Suite()
export class NodeWebUploadTest extends ModelBlobWebUploadServerSuite {
  dispatcherType = FetchWebDispatcher;

  serve() {
    return DependencyRegistry.getInstance(NodeWebApplication).then(v => v.serve());
  }
}
