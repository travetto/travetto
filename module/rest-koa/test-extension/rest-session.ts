// @file-if @travetto/rest-session
// @file-if aws-serverless-express

import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaRestSessionTest extends RestSessionServerSuite { }

@Suite()
export class KoaLambdaRestSessionTest extends RestSessionServerSuite {
  type = 'lambda';
}