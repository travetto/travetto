import { Suite } from '@travetto/test';
import { WebInternalSymbol } from '@travetto/web';
import { BasicWebServerSupport } from '@travetto/web/support/test/server-support.ts';

import { AuthWebServerSuite } from '../support/test/server.ts';

@Suite()
export class StandardAuthWebTest extends AuthWebServerSuite {
  type = BasicWebServerSupport;
  qualifier = WebInternalSymbol;
}
