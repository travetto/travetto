import { DependencyRegistryIndex } from '@travetto/di';
import { Suite } from '@travetto/test';

import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';

import { NodeWebHttpServer } from '../src/node.ts';
import { FetchWebDispatcher } from '../support/test/dispatcher.ts';

@Suite()
class NodeWebStandardTest extends StandardWebServerSuite {
  dispatcherType = FetchWebDispatcher;

  serve() {
    return DependencyRegistryIndex.getInstance(NodeWebHttpServer)
      .then(v => v.serve())
      .then(v => () => {
        v.stop(true);
      });
  }
}
