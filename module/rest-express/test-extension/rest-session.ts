// @file-if @travetto/rest-session
// @file-if aws-serverless-express

import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressRestSessionTest extends RestSessionServerSuite { }

@Suite()
export class ExpressLambdaRestSessionTest extends RestSessionServerSuite {
  type = 'lambda';
}