import { Suite } from '@travetto/test';
import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema.ts';

import { NodeWebApplication } from '../src/application.ts';
import { NodeWeFetchRouter } from '../support/test/fetch-router.ts';

@Suite()
export class NodeSchemaTest extends SchemaWebServerSuite {
  appType = NodeWebApplication;
  routerType = NodeWeFetchRouter;
}