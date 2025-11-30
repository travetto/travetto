import { Suite } from '@travetto/test';
import { NodeWebHttpServer } from '@travetto/web-http';
import { DependencyRegistryIndex } from '@travetto/di';

import { FetchWebDispatcher } from '@travetto/web-http/support/test/dispatcher.ts';

import { ModelBlobWebUploadServerSuite } from './suite.ts';

@Suite()
export class NodeWebUploadTest extends ModelBlobWebUploadServerSuite {
  dispatcherType = FetchWebDispatcher;

  serve() {
    return DependencyRegistryIndex.getInstance(NodeWebHttpServer).then(server => server.serve()).then(handle => () => handle.stop());
  }
}
