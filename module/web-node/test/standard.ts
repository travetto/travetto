import { Suite } from '@travetto/test';
import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';
import { NodeWebServerSupport } from '../support/test/server-support.ts';

@Suite()
export class NodeWebStandardTest extends StandardWebServerSuite {
  type = NodeWebServerSupport;
}