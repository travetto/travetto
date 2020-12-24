import { RestServerSuite } from '@travetto/rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressRestCoreTest extends RestServerSuite {
  constructor() {
    super(3002);
  }
}