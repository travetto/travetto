import { RestServerSuite } from '@travetto/rest/test-lib/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaRestCoreTest extends RestServerSuite {
  constructor() {
    super(3004);
  }
}