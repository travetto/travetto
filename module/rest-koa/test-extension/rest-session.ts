// @file-if @travetto/rest-session
// @file-if aws-serverless-express

import { RestSessionServerSuite } from '@travetto/rest-session//server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaRestSessionTest extends RestSessionServerSuite {
  constructor() {
    super(3004);
  }
}

@Suite()
export class KoaLambdaRestSessionTest extends RestSessionServerSuite {
  constructor() {
    super(true);
  }
}