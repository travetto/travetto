import { RestServerSuite } from '@travetto/rest/test-lib/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyRestCoreLambdaTest extends RestServerSuite {
  constructor() {
    super(true);
  }
}