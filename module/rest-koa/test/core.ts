import { Suite } from '@travetto/test';

import { RestServerSuite } from '@travetto/rest/support/test/server';

@Suite()
export class KoaRestCoreTest extends RestServerSuite { }