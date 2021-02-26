// @file-if @travetto/auth-rest
// @file-if aws-lambda-fastify

import { AuthRestServerSuite } from '@travetto/auth-rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyAuthRestTest extends AuthRestServerSuite { }

@Suite()
export class FastifyLambdaAuthRestTest extends AuthRestServerSuite {
  type = 'lambda';
}