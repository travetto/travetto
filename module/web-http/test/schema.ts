import { DependencyRegistryIndex } from '@travetto/di';
import { Suite } from '@travetto/test';

import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema.ts';

import { NodeWebHttpServer } from '../src/node.ts';
import { FetchWebDispatcher } from '../support/test/dispatcher.ts';

@Suite()
class NodeSchemaTest extends SchemaWebServerSuite {
  dispatcherType = FetchWebDispatcher;

  async serve() {
    return DependencyRegistryIndex.getInstance(NodeWebHttpServer)
      .then(v => v.serve())
      .then(v => () => v.stop());
  }
}
