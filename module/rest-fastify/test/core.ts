import { RestServerSuite } from '@travetto/rest/test-lib/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyRestCoreTest extends RestServerSuite {
  constructor() {
    super(3003);
  }
}