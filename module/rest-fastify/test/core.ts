import { RestServerSuite } from '@travetto/rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyRestCoreTest extends RestServerSuite {
  constructor() {
    super(3003);
  }
}