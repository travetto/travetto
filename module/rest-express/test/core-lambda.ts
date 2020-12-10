import { RestServerSuite } from '@travetto/rest/test/lib/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressRestCoreLambdaTest extends RestServerSuite {
  constructor() {
    super(true);
  }
}