import { RestServerSuite } from '@travetto/rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyRestCoreLambdaTest extends RestServerSuite {
  constructor() {
    super(true);
  }
}