import { Suite } from '@travetto/test';
import { NodeWebApplication } from '@travetto/web-node';
import { DependencyRegistry } from '@travetto/di';

import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema.ts';
import { FetchWebDispatcher } from '@travetto/web-node/support/test/dispatcher.ts';

@Suite()
export class NodeSchemaTest extends SchemaWebServerSuite {
  dispatcherType = FetchWebDispatcher;

  async serve() {
    return DependencyRegistry.getInstance(NodeWebApplication).then(v => v.serve());
  }
}