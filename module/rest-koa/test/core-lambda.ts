import { RestServerSuite } from '@travetto/rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaRestCoreLambdaTest extends RestServerSuite {
  type = 'lambda';
}