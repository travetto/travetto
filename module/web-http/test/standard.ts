import { Suite } from '@travetto/test';
import { DependencyRegistryIndex } from '@travetto/di';

import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';

import { FetchWebDispatcher } from '../support/test/dispatcher.ts';
import { NodeWebHttpServer } from '../src/node.ts';

@Suite()
export class NodeWebStandardTest extends StandardWebServerSuite {
  dispatcherType = FetchWebDispatcher;

  serve() {
    return DependencyRegistryIndex.getInstance(NodeWebHttpServer).then(v => v.serve()).then(v => () => { v.stop(true); });
  }
}