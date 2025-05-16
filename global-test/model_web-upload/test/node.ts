import { Suite } from '@travetto/test';
import { DefaultWebServer } from '@travetto/web-http-server';
import { DependencyRegistry } from '@travetto/di';

import { FetchWebDispatcher } from '@travetto/web-http-server/support/test/dispatcher.ts';

import { ModelBlobWebUploadServerSuite } from './suite.ts';

@Suite()
export class NodeWebUploadTest extends ModelBlobWebUploadServerSuite {
  dispatcherType = FetchWebDispatcher;

  serve() {
    return DependencyRegistry.getInstance(DefaultWebServer).then(v => v.serve()).then(v => v.kill);
  }
}
