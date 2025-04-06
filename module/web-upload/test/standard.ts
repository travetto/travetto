import { Suite } from '@travetto/test';
import { WebInternalSymbol } from '@travetto/web';
import { BasicWebServerSupport } from '@travetto/web/support/test/server-support.ts';

import { WebUploadServerSuite } from '../support/test/server.ts';

@Suite()
export class StandardAuthWebTest extends WebUploadServerSuite {
  type = BasicWebServerSupport;
  qualifier = WebInternalSymbol;
}
