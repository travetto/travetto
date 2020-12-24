// @file-if @travetto/rest-session
// @file-if aws-serverless-express

import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressRestSessionTest extends RestSessionServerSuite {
  constructor() {
    super(3002);
  }
}

@Suite()
export class ExpressLambdaRestSessionTest extends RestSessionServerSuite {
  constructor() {
    super(true);
  }
}