import { Suite } from '@travetto/test';

import { RestServerSuite } from '@travetto/rest/support/test/server.ts';

@Suite()
export class ExpressRestCoreTest extends RestServerSuite { }