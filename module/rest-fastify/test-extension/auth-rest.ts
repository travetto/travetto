// @file-if @travetto/auth-rest
// @file-if aws-lambda-fastify

import { AuthRestServerSuite } from '@travetto/auth-rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyAuthRestTest extends AuthRestServerSuite {
  constructor() {
    super(3003);
  }
}

@Suite()
export class FastifyLambdaAuthRestTest extends AuthRestServerSuite {
  constructor() {
    super(true);
  }
}