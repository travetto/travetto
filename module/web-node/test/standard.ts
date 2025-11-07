import { Suite } from '@travetto/test';
import { NodeWebServer } from '@travetto/web-node';
import { DependencyRegistryIndex } from '@travetto/di';

import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';
import { FetchWebDispatcher } from '@travetto/web-http-server/support/test/dispatcher.ts';

@Suite()
export class NodeWebStandardTest extends StandardWebServerSuite {
  dispatcherType = FetchWebDispatcher;

  serve() {
    return DependencyRegistryIndex.getInstance(NodeWebServer).then(v => v.serve()).then(v => () => { v.stop(true); });
  }
}