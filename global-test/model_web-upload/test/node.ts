import { Suite } from '@travetto/test';
import { NodeWebServer } from '@travetto/web-node';
import { DependencyRegistry } from '@travetto/di';

import { FetchWebDispatcher } from '@travetto/web-http-server/support/test/dispatcher.ts';

import { ModelBlobWebUploadServerSuite } from './suite.ts';

@Suite()
export class NodeWebUploadTest extends ModelBlobWebUploadServerSuite {
  dispatcherType = FetchWebDispatcher;

  serve() {
    return DependencyRegistry.getInstance(NodeWebServer).then(v => v.serve()).then(v => v.kill);
  }
}
