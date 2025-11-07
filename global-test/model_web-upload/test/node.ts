import { Suite } from '@travetto/test';
import { NodeWebServer } from '@travetto/web-node';
import { DependencyRegistryIndex } from '@travetto/di';

import { FetchWebDispatcher } from '@travetto/web-http-server/support/test/dispatcher.ts';

import { ModelBlobWebUploadServerSuite } from './suite.ts';

@Suite()
export class NodeWebUploadTest extends ModelBlobWebUploadServerSuite {
  dispatcherType = FetchWebDispatcher;

  async serve() {
    const server = await DependencyRegistryIndex.getInstance(NodeWebServer);
    const handle = await server.serve();
    return () => { handle.stop(); };
  }
}
