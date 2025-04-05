import { Suite } from '@travetto/test';
import { WebServerSuite } from '@travetto/web/support/test/server.ts';
import { NodeWebServerSupport } from '../support/test/server-support';

@Suite()
export class NodeWebCoreTest extends WebServerSuite {
  type = NodeWebServerSupport;
}