import { Suite } from '@travetto/test';
import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema.ts';

import { NodeWebApplication } from '../src/application.ts';
import { FetchWebDispatcher } from '../support/test/dispatcher.ts';

@Suite()
export class NodeSchemaTest extends SchemaWebServerSuite {
  appType = NodeWebApplication;
  dispatcherType = FetchWebDispatcher;
}