import { Suite } from '@travetto/test';
import { NodeWebServer } from '@travetto/web-node';
import { DependencyRegistryIndex } from '@travetto/di';

import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema.ts';
import { FetchWebDispatcher } from '@travetto/web-http-server/support/test/dispatcher.ts';

@Suite()
export class NodeSchemaTest extends SchemaWebServerSuite {
  dispatcherType = FetchWebDispatcher;

  async serve() {
    return DependencyRegistryIndex.getInstance(NodeWebServer).then(v => v.serve()).then(v => () => v.stop());
  }
}