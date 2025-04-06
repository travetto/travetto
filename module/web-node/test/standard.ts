import { Suite } from '@travetto/test';
import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';

import { NodeWebApplication } from '../src/application.ts';
import { FetchWebDispatcher } from '../support/test/dispatcher.ts';

@Suite()
export class NodeWebStandardTest extends StandardWebServerSuite {
  appType = NodeWebApplication;
  dispatcherType = FetchWebDispatcher;
}