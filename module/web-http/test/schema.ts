import { Suite } from '@travetto/test';
import { DependencyRegistryIndex } from '@travetto/di';
import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema.ts';

import { FetchWebDispatcher } from '../support/test/dispatcher.ts';
import { NodeWebHttpServer } from '../src/node.ts';

@Suite()
class NodeSchemaTest extends SchemaWebServerSuite {
  dispatcherType = FetchWebDispatcher;

  async serve() {
    return DependencyRegistryIndex.getInstance(NodeWebHttpServer).then(v => v.serve()).then(v => () => v.stop());
  }
}