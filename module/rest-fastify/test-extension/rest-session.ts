// @file-if @travetto/rest-session
// @file-if aws-lambda-fastify

import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyRestSessionTest extends RestSessionServerSuite {
  constructor() {
    super(3003);
  }
}

@Suite()
export class FastifyLambdaRestSessionTest extends RestSessionServerSuite {
  constructor() {
    super(true);
  }
}