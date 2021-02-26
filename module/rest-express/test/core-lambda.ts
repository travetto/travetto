import { RestServerSuite } from '@travetto/rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressRestCoreLambdaTest extends RestServerSuite {
  type = 'lambda';
}