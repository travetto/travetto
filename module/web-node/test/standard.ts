import { Suite } from '@travetto/test';
import { NodeWebApplication } from '@travetto/web-node';
import { DependencyRegistry } from '@travetto/di';

import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';
import { FetchWebDispatcher } from '@travetto/web-node/support/test/dispatcher.ts';

@Suite()
export class NodeWebStandardTest extends StandardWebServerSuite {
  dispatcherType = FetchWebDispatcher;

  serve() {
    return DependencyRegistry.getInstance(NodeWebApplication).then(v => v.serve());
  }
}