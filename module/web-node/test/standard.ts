import { Suite } from '@travetto/test';
import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';

import { NodeWebApplication } from '../src/application.ts';
import { NodeWeFetchRouter } from '../support/test/fetch-router.ts';

@Suite()
export class NodeWebStandardTest extends StandardWebServerSuite {
  appType = NodeWebApplication;
  routerType = NodeWeFetchRouter;
}