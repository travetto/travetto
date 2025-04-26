import { Suite } from '@travetto/test';
import { NodeWebApplication } from '@travetto/web-node';

import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';
import { FetchWebDispatcher } from '@travetto/web-node/support/test/dispatcher.ts';

@Suite()
export class NodeWebStandardTest extends StandardWebServerSuite {
  appType = NodeWebApplication;
  dispatcherType = FetchWebDispatcher;
}